import { DEV_SERVER } from "../../scripts/lib.js";

// What the screen shows for one step. "pending" means "seen in an earlier run, not started yet".
export type StepView = {
  name: string;
  status: "pending" | "running" | "done" | "retrying" | "failed";
  note: string;
  op: string; // the Dev Server's name for the primitive: RUN, SLEEP, WAIT_FOR_EVENT, INVOKE ...
  tries: number; // attempts made so far, counting the one under way (or the next one, if retrying)
  startedAt: number | null; // epoch ms
  endedAt: number | null; // null while the step is still going
};
export type RunView = {
  id: string;
  fn: string; // the function id without the day prefix, e.g. "create-card"
  cardId: string; // what the run is about (or a short description for batches)
  who: string; // recipient name, shown when several runs share one card id
  status: "running" | "done" | "failed" | "cancelled";
  steps: StepView[];
  output: unknown;
  startedAt: number | null; // epoch ms
  endedAt: number | null;
  data: Record<string, unknown>; // the event data that started the run (the first event of a batch)
};

async function gql<T>(query: string): Promise<T> {
  const res = await fetch(`${DEV_SERVER}/v0/gql`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query }),
    signal: AbortSignal.timeout(1500), // a Dev Server that is restarting must not stall the page
  });
  const body = (await res.json()) as { data?: T; errors?: { message: string }[] };
  if (body.errors?.length) throw new Error(body.errors[0].message);
  return body.data as T;
}

export async function devServerIsUp(): Promise<boolean> {
  try {
    await gql("{ __typename }");
    return true;
  } catch {
    return false;
  }
}

// ---------- The list of runs ----------

type ListedRun = { id: string; status: string; slug: string };

async function listRuns(since: number): Promise<ListedRun[]> {
  const from = new Date(since).toISOString();
  const runs: ListedRun[] = [];
  let after: string | null = null;
  // The Dev Server returns at most 200 runs per page, so keep asking until there are no more.
  do {
    const page: RunsPage = await gql<RunsPage>(`{
      runs(first: 200, ${after ? `after: "${after}", ` : ""}orderBy: [{ field: QUEUED_AT, direction: ASC }], filter: { from: "${from}" }) {
        pageInfo { hasNextPage endCursor }
        edges { node { id status function { slug } } }
      }
    }`);
    for (const { node } of page.runs.edges)
      runs.push({ id: node.id, status: node.status, slug: node.function.slug });
    after = page.runs.pageInfo.hasNextPage ? page.runs.pageInfo.endCursor : null;
  } while (after);
  return runs;
}

type RunsPage = {
  runs: {
    pageInfo: { hasNextPage: boolean; endCursor: string };
    edges: { node: { id: string; status: string; function: { slug: string } } }[];
  };
};

/** Cancels every run queued since `since` that has not finished, so a cleared screen stays quiet. */
export async function cancelUnfinished(since: number): Promise<void> {
  for (const run of await listRuns(since)) {
    if (run.status !== "RUNNING" && run.status !== "QUEUED") continue;
    await gql(`mutation { cancelRun(runID: "${run.id}") { id } }`).catch(() => {});
  }
}

// ---------- One run's steps (the "trace") ----------

type Span = {
  name: string;
  status: string;
  attempts: number | null;
  stepOp: string | null;
  startedAt: string | null;
  endedAt: string | null;
  childrenSpans: Span[];
};
type RunDetail = {
  status: string;
  output: string | null;
  startedAt: string | null;
  endedAt: string | null;
  trace: { childrenSpans: Span[] };
  trigger: { payloads: string[]; isBatch: boolean; eventName: string } | null;
};

const DETAIL_FIELDS = `
  status output startedAt endedAt
  trace { childrenSpans { name status attempts stepOp startedAt endedAt childrenSpans { name } } }`;

/**
 * Asks for many runs in one request. GraphQL aliases (r0, r1, ...) let one query carry them all.
 * Ids come from the Dev Server itself; the check keeps odd text out of the query anyway.
 */
async function fetchDetails(ids: string[]): Promise<Map<string, RunDetail>> {
  const safe = ids.filter((id) => /^[0-9A-Z]{26}$/.test(id));
  if (safe.length === 0) return new Map();
  const parts = safe.map(
    (id, i) =>
      `r${i}: run(runID: "${id}") { ${DETAIL_FIELDS} }
       t${i}: runTrigger(runID: "${id}") { payloads isBatch eventName }`,
  );
  const data = await gql<Record<string, unknown>>(`{ ${parts.join("\n")} }`);
  const details = new Map<string, RunDetail>();
  safe.forEach((id, i) => {
    const run = data[`r${i}`] as Omit<RunDetail, "trigger"> | null;
    if (run) details.set(id, { ...run, trigger: data[`t${i}`] as RunDetail["trigger"] });
  });
  return details;
}

/**
 * The trace has one span per attempt plus one that groups a step's attempts, all with the
 * step's name. For each name, keep the span of the newest attempt (and prefer a running one).
 */
function stepsOf(spans: Span[], runIsOver: boolean): StepView[] {
  const byName = new Map<string, Span[]>();
  for (const span of spans) {
    if (span.stepOp === null) continue; // the Dev Server's own bookkeeping span
    byName.set(span.name, [...(byName.get(span.name) ?? []), span]);
  }
  // The grouping span starts when the run does, so order steps by their plain attempt spans.
  const startOf = (group: Span[]) => {
    const plain = group.filter((s) => s.childrenSpans.length === 0);
    return Math.min(
      ...(plain.length > 0 ? plain : group).map((s) => Date.parse(s.startedAt ?? "")),
    );
  };
  const steps: StepView[] = [];
  const ordered = [...byName].sort((a, b) => startOf(a[1]) - startOf(b[1]));
  for (const [name, group] of ordered) {
    const newest = Math.max(...group.map((s) => s.attempts ?? 0));
    const latest = group.filter((s) => (s.attempts ?? 0) === newest);
    const span = latest.find((s) => s.status === "RUNNING") ?? latest[0];
    const view = stepView(name, span, newest, runIsOver);
    // Time spans all attempts, so a retried step shows as one long bar.
    const stillGoing = group.some((s) => ["RUNNING", "WAITING", "QUEUED"].includes(s.status));
    const ends = group.flatMap((s) => (s.endedAt ? [Date.parse(s.endedAt)] : []));
    view.startedAt = startOf(group) || null;
    view.endedAt = stillGoing || ends.length === 0 ? null : Math.max(...ends);
    steps.push(view);
  }
  return steps;
}

const WAITING_NOTE: Record<string, string> = {
  SLEEP: "sleeping",
  WAIT_FOR_EVENT: "waiting for an event",
  WAIT_FOR_SIGNAL: "waiting for a signal",
  INVOKE: "waiting for the child run",
};

function stepView(name: string, span: Span, attempt: number, runIsOver: boolean): StepView {
  const op = span.stepOp ?? "RUN";
  const waiting = WAITING_NOTE[op] ?? "running";
  const base = { name, op, tries: attempt + 1, startedAt: null, endedAt: null };
  switch (span.status) {
    case "COMPLETED":
      return { ...base, status: "done", note: "done" };
    case "WAITING": // a sleep or a wait-for-event that has not finished
      return { ...base, status: "running", note: waiting };
    case "QUEUED":
      return { ...base, status: "running", note: "queued" };
    case "RUNNING":
      if (attempt > 0) return { ...base, status: "retrying", note: `retry ${attempt}` };
      return { ...base, status: "running", note: waiting };
    case "CANCELLED":
      return { ...base, status: "failed", note: "cancelled" };
    case "SKIPPED":
      return { ...base, status: "pending", note: "skipped" };
    default: // FAILED: over for good if the run ended, otherwise the next retry is coming
      if (runIsOver)
        return { ...base, status: "failed", note: `failed after ${attempt + 1} tries` };
      return { ...base, status: "retrying", note: "will retry", tries: attempt + 2 };
  }
}

/** With checkpointing the output arrives as ops like [{"op":"RunComplete","data":{...}}]. */
function readOutput(raw: string | null): unknown {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    const done = Array.isArray(parsed) ? parsed.find((o) => o?.op === "RunComplete") : undefined;
    return done ? done.data : parsed;
  } catch {
    return null;
  }
}

type Payload = { cardId?: string; to?: string; event?: { data?: Payload } };
type Data = Record<string, unknown>;

/** The card id, and the recipient's name for runs that share a card id (Day 09's fan-out). */
function whoIs(trigger: RunDetail["trigger"]): { cardId: string; who: string; data: Data } {
  if (!trigger) return { cardId: "", who: "", data: {} };
  const payloads = trigger.payloads.map((p) => JSON.parse(p) as { data?: Payload });
  const data = payloads[0]?.data;
  const plain = (data ?? {}) as Data;
  if (trigger.isBatch) return { cardId: `${payloads.length} events`, who: "", data: plain };
  // A failure handler's event wraps the original one: data.event.data.cardId.
  const cardId = data?.cardId ?? data?.event?.data?.cardId;
  return {
    cardId: cardId ?? trigger.eventName,
    who: data?.to?.split("@")[0] ?? "",
    data: plain,
  };
}

// ---------- Putting it together ----------

const STATUS: Record<string, RunView["status"]> = {
  COMPLETED: "done",
  FAILED: "failed",
  CANCELLED: "cancelled",
};

const finished = new Map<string, RunView>(); // finished runs never change, so ask once
const openRuns = new Map<string, RunView>(); // the latest view of runs still going
const knownSteps = new Map<string, { name: string; op: string }[]>(); // day prefix + function -> steps, longest list seen

export function forgetFinishedRuns(): void {
  finished.clear();
  openRuns.clear();
}

/** Every run of one day since `since`, with its steps. `prefix` is e.g. "day-01-". */
export async function readRuns(prefix: string, since: number): Promise<RunView[]> {
  const listed = (await listRuns(since)).filter((r) => r.slug.startsWith(prefix));
  const open = listed.filter((r) => !finished.has(r.id)).slice(0, 80);
  const details = await fetchDetails(open.map((r) => r.id));

  for (const run of open) {
    const detail = details.get(run.id);
    if (!detail) continue;
    const fn = run.slug.slice(prefix.length);
    const status = STATUS[detail.status] ?? "running";
    const steps = stepsOf(detail.trace.childrenSpans, status !== "running");
    if (status === "cancelled") {
      // A cancelled run leaves its sleep or wait looking busy: it was stopped there.
      for (const step of steps) {
        if (step.status === "running") Object.assign(step, { status: "failed", note: "cancelled" });
      }
    }
    const view: RunView = {
      id: run.id,
      fn,
      ...whoIs(detail.trigger),
      status,
      steps,
      output: readOutput(detail.output),
      startedAt: detail.startedAt ? Date.parse(detail.startedAt) : null,
      endedAt: detail.endedAt ? Date.parse(detail.endedAt) : null,
    };
    if (status === "running") {
      // Steps we have seen in earlier runs of this function but this run has not reached yet.
      const seen = new Set(steps.map((s) => s.name));
      const later = (knownSteps.get(prefix + fn) ?? []).filter((k) => !seen.has(k.name));
      view.steps = [
        ...steps,
        ...later.map((k) => ({
          name: k.name,
          op: k.op,
          status: "pending" as const,
          note: "waiting",
          tries: 0,
          startedAt: null,
          endedAt: null,
        })),
      ];
      openRuns.set(run.id, view);
    } else {
      finished.set(run.id, view);
      openRuns.delete(run.id);
      if (steps.length > (knownSteps.get(prefix + fn)?.length ?? 0))
        knownSteps.set(
          prefix + fn,
          steps.map((s) => ({ name: s.name, op: s.op })),
        );
    }
  }

  return listed.flatMap((r) => {
    const view = finished.get(r.id) ?? openRuns.get(r.id);
    return view ? [view] : [];
  });
}
