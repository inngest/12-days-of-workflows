import { type ChildProcess, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { LedgerEntry, RunStatus, Scenario } from "@12days/shared";
import type { Inngest } from "inngest";
import {
  type Day,
  DEV_SERVER,
  listDays,
  loadDay,
  ROOT,
  resolveDay,
  sleep,
  startApp,
  startDevServer,
  stop,
  waitFor,
} from "./lib.js";

process.env.INNGEST_DEV = "1";

type Run = { id: string; status: string; slug: string; output: unknown };

// ---------- 1. Static checks ----------

function runStep(label: string, command: string, args: string[]) {
  console.log(`> ${label}`);
  const result = spawnSync(command, args, { cwd: ROOT, stdio: "inherit" });
  if (result.status !== 0) {
    console.error(`FAIL ${label}`);
    process.exit(1);
  }
}

// ---------- 5. Lesson budget ----------

/** Non-blank lines inside @lesson regions, excluding stubs. Throws on bad markers. */
export function countLessonLines(source: string, file: string): number {
  let inside = false;
  let count = 0;
  source.split("\n").forEach((line, i) => {
    const text = line.trim();
    const where = `${file}:${i + 1}`;
    if (text.startsWith("// @lesson:start")) {
      if (inside) throw new Error(`${where}: nested @lesson:start`);
      inside = true;
    } else if (text.startsWith("// @lesson:end")) {
      if (!inside) throw new Error(`${where}: @lesson:end without start`);
      inside = false;
    } else if (text.startsWith("// @lesson:stub")) {
      if (!inside) throw new Error(`${where}: @lesson:stub outside a region`);
    } else if (inside && text !== "") {
      count++;
    }
  });
  if (inside) throw new Error(`${file}: unclosed @lesson:start`);
  return count;
}

function checkBudget(day: Day, budget: number): string | null {
  let used = 0;
  for (const file of ["src/functions.ts", "src/events.ts"]) {
    let source: string;
    try {
      source = readFileSync(join(day.dir, file), "utf8");
    } catch {
      continue;
    }
    used += countLessonLines(source, file);
  }
  const line = `${used}/${budget} lesson lines`;
  return used > budget ? `over budget: ${line}` : line;
}

// ---------- Dev Server queries ----------

async function gql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(`${DEV_SERVER}/v0/gql`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const body = (await res.json()) as { data?: T; errors?: { message: string }[] };
  if (body.errors?.length) throw new Error(`Dev Server GraphQL: ${body.errors[0].message}`);
  return body.data as T;
}

const RUNS_QUERY = `query Runs($from: Time!, $after: String) {
  runs(first: 200, after: $after, orderBy: [{ field: QUEUED_AT, direction: ASC }], filter: { from: $from }) {
    pageInfo { hasNextPage endCursor }
    edges { node { id status output function { slug } } }
  }
}`;

type RunsPage = {
  runs: {
    pageInfo: { hasNextPage: boolean; endCursor: string };
    edges: { node: { id: string; status: string; output: unknown; function: { slug: string } } }[];
  };
};

/** Every run queued since `from`, across all functions (incl. invoked and fan-out children). */
async function runsSince(from: string): Promise<Run[]> {
  const runs: Run[] = [];
  let after: string | undefined;
  do {
    const page: RunsPage = await gql(RUNS_QUERY, { from, after });
    for (const { node } of page.runs.edges) {
      runs.push({
        id: node.id,
        status: node.status,
        slug: node.function.slug,
        output: node.output,
      });
    }
    after = page.runs.pageInfo.hasNextPage ? page.runs.pageInfo.endCursor : undefined;
  } while (after);
  return runs;
}

const STATUS: Record<string, RunStatus> = {
  COMPLETED: "Completed",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
  RUNNING: "Running",
  QUEUED: "Running",
};

async function cancelUnfinished(from: string) {
  for (const run of await runsSince(from)) {
    if (STATUS[run.status] === "Running") {
      await gql("mutation Cancel($id: ULID!) { cancelRun(runID: $id) { id } }", { id: run.id });
    }
  }
}

// ---------- App lifecycle ----------

class DayHarness {
  app?: ChildProcess;
  dev?: ChildProcess;
  env: Record<string, string> = {};
  output: string[] = [];

  constructor(
    readonly day: Day,
    readonly appId: string,
  ) {}

  private remember = (line: string) => {
    this.output.push(line);
    if (this.output.length > 200) this.output.shift();
  };

  async start() {
    this.dev = startDevServer([this.day], { onLine: () => {} });
    await waitFor("Dev Server", async () => (await fetch(DEV_SERVER)).ok);
    await this.startApp({});
  }

  async startApp(env: Record<string, string>) {
    this.env = env;
    this.app = startApp(this.day, { env, onLine: this.remember });
    const appUrl = `http://localhost:${this.day.port}/api/inngest`;
    let expected = 0;
    await waitFor("app", async () => {
      const res = await fetch(appUrl);
      expected = ((await res.json()) as { function_count: number }).function_count;
      return res.ok;
    });
    await fetch(appUrl, { method: "PUT" });
    await waitFor("app sync", async () => {
      const dev = (await (await fetch(`${DEV_SERVER}/dev`)).json()) as {
        functions: { slug: string }[];
      };
      return dev.functions.filter((f) => f.slug.startsWith(`${this.appId}-`)).length === expected;
    });
  }

  async useEnv(env: Record<string, string>) {
    if (JSON.stringify(env) === JSON.stringify(this.env)) return;
    if (this.app) await stop(this.app);
    await this.startApp(env);
  }

  async ledger(): Promise<LedgerEntry[]> {
    return (await fetch(`http://localhost:${this.day.port}/__ledger`)).json() as Promise<
      LedgerEntry[]
    >;
  }

  async resetLedger() {
    await fetch(`http://localhost:${this.day.port}/__ledger`, { method: "DELETE" });
  }

  async stop() {
    await Promise.all([this.app, this.dev].filter((c) => c !== undefined).map(stop));
  }
}

// ---------- 3. Scenario assertions ----------

function assertScenario(
  expect: Scenario["expect"],
  appId: string,
  ledger: LedgerEntry[],
  runs: Run[],
): string[] {
  const failures: string[] = [];

  for (const want of expect.runs ?? []) {
    const slug = `${appId}-${want.fn}`;
    const mine = runs.filter((r) => r.slug === slug);
    const statuses = mine.map((r) => STATUS[r.status] ?? r.status);
    const matching = statuses.filter((s) => s === want.status).length;
    const seen = statuses.length ? statuses.join(", ") : "no runs";
    if (want.count !== undefined) {
      if (matching !== want.count) {
        failures.push(`runs ${want.fn}: expected ${want.count} ${want.status}, saw ${seen}`);
      }
    } else if (mine.length === 0 || matching !== mine.length) {
      failures.push(`runs ${want.fn}: expected all ${want.status}, saw ${seen}`);
    }
  }

  for (const [key, want] of Object.entries(expect.ledger ?? {})) {
    const [provider, op] = key.split(".");
    const got = ledger.filter((e) => e.provider === provider && e.op === op).length;
    if (got !== want) failures.push(`ledger ${key}: expected ${want}, got ${got}`);
  }

  if (expect.deliveredOrder) {
    const got = ledger
      .filter((e) => e.provider === "mail" && e.op === "sendCard" && e.ok)
      .map((e) => e.cardId);
    if (JSON.stringify(got) !== JSON.stringify(expect.deliveredOrder)) {
      failures.push(
        `deliveredOrder: expected ${expect.deliveredOrder.join(",")}, got ${got.join(",")}`,
      );
    }
  }

  const custom = expect.custom?.(ledger);
  if (custom) failures.push(`custom: ${custom}`);

  return failures;
}

async function runScenario(
  harness: DayHarness,
  inngest: Inngest,
  scenario: Scenario,
): Promise<string[]> {
  await harness.useEnv(scenario.env ?? {});
  await harness.resetLedger();
  const from = new Date(Date.now() - 1000).toISOString();
  const ids = await scenario.send({ inngest, sleep });
  await sleep(scenario.expect.settleMs);

  const failures = ids.length === 0 ? ["send returned no event ids"] : [];
  failures.push(
    ...assertScenario(
      scenario.expect,
      harness.appId,
      await harness.ledger(),
      await runsSince(from),
    ),
  );
  // Leftover retries would write to the next scenario's ledger.
  await cancelUnfinished(from);
  return failures;
}

// ---------- Main ----------

async function checkDay(day: Day): Promise<boolean> {
  const { inngest, mod } = await loadDay(day);
  let ok = true;

  const budget = checkBudget(day, mod.lessonBudget);
  const overBudget = budget?.startsWith("over budget") ?? false;
  console.log(`${overBudget ? "FAIL" : "PASS"} ${day.nn} lesson-budget ${budget}`);
  if (overBudget) ok = false;

  const harness = new DayHarness(day, inngest.id);
  const onSigint = async () => {
    await harness.stop();
    process.exit(130);
  };
  process.once("SIGINT", onSigint);
  try {
    await harness.start();
    for (const [name, scenario] of Object.entries(mod.scenarios)) {
      const started = Date.now();
      const failures = await runScenario(harness, inngest, scenario).catch((err: Error) => [
        `error: ${err.message}`,
      ]);
      const secs = `${((Date.now() - started) / 1000).toFixed(1)}s`;
      console.log(`${failures.length ? "FAIL" : "PASS"} ${day.nn} ${name} ${secs}`);
      for (const failure of failures) console.log(`     ${failure}`);
      if (failures.length) {
        ok = false;
        console.log(`     last app output:\n       ${harness.output.slice(-15).join("\n       ")}`);
      }
    }
  } finally {
    process.off("SIGINT", onSigint);
    await harness.stop();
  }
  return ok;
}

const selected = process.argv.slice(2);
const days = (selected.length ? selected : listDays().map((d) => d.slice(0, 2))).map(resolveDay);

runStep("tsc -b", join(ROOT, "node_modules/.bin/tsc"), ["-b"]);
runStep("biome check", join(ROOT, "node_modules/.bin/biome"), ["check", "."]);

const inUse = await fetch(DEV_SERVER).then(
  () => true,
  () => false,
);
if (inUse) {
  console.error("Port 8288 is busy. Stop `pnpm day` (or any Dev Server) before running checks.");
  process.exit(1);
}

let allOk = true;
for (const day of days) {
  if (!(await checkDay(day))) allOk = false;
}
process.exit(allOk ? 0 : 1);
