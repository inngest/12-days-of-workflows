import { type ChildProcess, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { LedgerEntry, RunStatus, Scenario } from "@12days/shared";
import type { Inngest } from "inngest";
import {
  countLessonLines,
  type Day,
  DEV_SERVER,
  LESSON_FILES,
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

function checkBudget(day: Day, budget: number): string | null {
  let used = 0;
  for (const file of LESSON_FILES) {
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
    edges { node { id status function { slug } } }
  }
}`;

type RunsPage = {
  runs: {
    pageInfo: { hasNextPage: boolean; endCursor: string };
    edges: { node: { id: string; status: string; function: { slug: string } } }[];
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
        output: undefined,
      });
    }
    after = page.runs.pageInfo.hasNextPage ? page.runs.pageInfo.endCursor : undefined;
  } while (after);
  return runs;
}

/**
 * The runs list leaves `output` empty, so fetch it per run. With checkpointing the Dev Server
 * stores it as ops, e.g. `[{"op":"RunComplete","data":{...}}]`; unwrap to the returned value.
 */
async function runOutput(id: string): Promise<unknown> {
  const { run } = await gql<{ run: { output: string | null } }>(
    "query Run($id: String!) { run(runID: $id) { output } }",
    { id },
  );
  if (!run.output) return null;
  const parsed: unknown = JSON.parse(run.output);
  const op = Array.isArray(parsed) ? parsed.find((o) => o?.op === "RunComplete") : undefined;
  return op ? op.data : parsed;
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
      // A run can finish between listing and cancelling; that's fine.
      await gql("mutation Cancel($id: ULID!) { cancelRun(runID: $id) { id } }", {
        id: run.id,
      }).catch((err: Error) => {
        if (!err.message.includes("ended run")) throw err;
      });
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
    if (want.output !== undefined) {
      const wanted = JSON.stringify(want.output);
      for (const run of mine) {
        const got = JSON.stringify(run.output);
        if (got !== wanted) failures.push(`runs ${want.fn}: expected output ${wanted}, got ${got}`);
      }
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
  const deadline = Date.now() + scenario.expect.settleMs;

  // Retry backoff jitters a lot, so scenarios that only expect finished runs pass as soon as
  // everything holds, with settleMs as the deadline. "Still Running" needs the full wait.
  const wantedRuns = scenario.expect.runs ?? [];
  const canFinishEarly = wantedRuns.length > 0 && wantedRuns.every((r) => r.status !== "Running");

  let failures: string[];
  for (;;) {
    if (!canFinishEarly) await sleep(deadline - Date.now());
    failures = await evaluateScenario(harness, scenario, from);
    if (failures.length === 0 || Date.now() >= deadline) break;
    await sleep(Math.min(POLL_MS, deadline - Date.now()));
  }

  if (ids.length === 0) failures.unshift("send returned no event ids");
  // Leftover retries would write to the next scenario's ledger.
  await cancelUnfinished(from);
  return failures;
}

const POLL_MS = 2_000;

async function evaluateScenario(
  harness: DayHarness,
  scenario: Scenario,
  from: string,
): Promise<string[]> {
  const runs = await runsSince(from);
  const wantsOutput = (scenario.expect.runs ?? []).filter((r) => r.output !== undefined);
  for (const run of runs) {
    if (wantsOutput.some((r) => run.slug === `${harness.appId}-${r.fn}`)) {
      run.output = await runOutput(run.id);
    }
  }
  return assertScenario(scenario.expect, harness.appId, await harness.ledger(), runs);
}

// ---------- Ledger wall ----------

/** The on-camera page loads and knows which day it's showing. null = pass. */
async function checkWall(day: Day): Promise<string | null> {
  const base = `http://localhost:${day.port}`;
  const page = await fetch(base);
  if (!page.ok || !(await page.text()).includes("/__ledger"))
    return `GET / returned ${page.status}`;
  const config = (await (await fetch(`${base}/__wall`)).json()) as { title: string };
  return config.title.startsWith(`Day ${day.nn}:`) ? null : `wall title "${config.title}"`;
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
    const wall = await checkWall(day);
    console.log(`${wall ? "FAIL" : "PASS"} ${day.nn} ledger-wall${wall ? `\n     ${wall}` : ""}`);
    if (wall) ok = false;
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
