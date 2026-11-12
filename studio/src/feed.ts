import type { LedgerEntry } from "@12days/shared";
import type { RunView, StepView } from "./devserver.js";
import type { Profile } from "./profiles.js";
import { say } from "./words.js";

// ---------- The friendly status feed ----------

export type FeedLine = {
  id: string;
  status: "done" | "running" | "pending" | "retrying" | "failed";
  text: string;
};

type Group = { id: string; fn: string; op: string; views: StepView[] };

/**
 * One line per step. When many runs share a step (a rush of cards) the line counts them:
 * "Artwork painted · all 15". `mains` are the functions whose steps are listed; steps of any
 * other function only matter through `childStep`, whose retries show up on the invoke line.
 */
export function feedLines(
  runs: RunView[],
  mains: string[],
  plan: string[],
  childStep: string | undefined,
  entries: LedgerEntry[],
  holding?: string,
): FeedLine[] {
  const tracked = runs.filter((r) => mains.includes(r.fn));
  if (tracked.length === 0 && holding) {
    return [
      { id: "holding", status: "running", text: holding },
      ...plan.map((id): FeedLine => ({ id, status: "pending", text: say(id, "doing") })),
    ];
  }
  const stillGoing = tracked.length === 0 || tracked.some((r) => r.status === "running");
  if (tracked.length > 0 && plan.length === 0 && tracked.every((r) => r.steps.length === 0))
    return linesFromLedger(entries, tracked[0].status === "running");

  const groups = new Map<string, Group>();
  for (const run of tracked) {
    for (const step of run.steps) {
      const group = groups.get(step.name) ?? { id: step.name, fn: run.fn, op: step.op, views: [] };
      group.views.push(step);
      groups.set(step.name, group);
    }
  }

  const childViews = childStep
    ? runs
        .filter((r) => !mains.includes(r.fn))
        .flatMap((r) => r.steps.filter((s) => s.name === childStep))
    : [];

  const lines = [...groups.values()].map((group) => lineOf(group, tracked, childViews));
  if (stillGoing) {
    for (const id of plan) {
      if (!groups.has(id)) lines.push({ id, status: "pending", text: say(id, "doing") });
    }
  }
  return lines;
}

function lineOf(group: Group, tracked: RunView[], childViews: StepView[]): FeedLine {
  // How many runs this line is about. A step only some runs take (a variant) counts those runs
  // once the function has finished; until then every run might still get there.
  const ofFn = tracked.filter((r) => r.fn === group.fn);
  const total = ofFn.every((r) => r.status !== "running")
    ? group.views.filter((v) => v.status !== "pending").length
    : ofFn.length;
  const count = (status: StepView["status"]) =>
    group.views.filter((v) => v.status === status).length;
  const done = count("done");
  let running = count("running");
  let retrying = count("retrying");
  const failed = count("failed");
  let tries = Math.max(...group.views.map((v) => v.tries));

  // A step.invoke that is waiting on a child run: the child's retries are this step's retries.
  const childRetries = childViews.filter((v) => v.status === "retrying");
  if (group.op === "INVOKE" && childRetries.length > 0) {
    retrying = childRetries.length;
    running = Math.max(0, running - retrying);
    tries = Math.max(...childRetries.map((v) => v.tries));
  }

  const cancelled = group.views.some((v) => v.note === "cancelled");
  if (cancelled) return { id: group.id, status: "done", text: "Cancelled, as you asked" };

  let status: FeedLine["status"] = "pending";
  if (retrying > 0) status = "retrying";
  else if (failed > 0 && running === 0) status = "failed";
  else if (running > 0) status = "running";
  else if (done >= total) status = "done";
  else if (done > 0) status = "running"; // some are done, the rest are between steps

  const state = status === "pending" || status === "running" ? "doing" : status;
  let text = say(group.id, state, tries);
  if (status === "done" && total === 1 && tries > 1) text += ` (after ${tries} tries)`;
  if (total > 1) {
    if (status === "done") text += ` · all ${total}`;
    else if (status === "retrying") text += ` · ${retrying} of ${total}`;
    else if (status !== "pending") text += ` · ${done}/${total}`;
  }
  return { id: group.id, status, text };
}

// A function with no steps (a "before") has nothing to list, but the ledger shows what it
// did: every call, in order. A retry that repeats the first call shows up as another line.
const CHAIN = ["write-text", "render-image", "deliver"];
const STEP_OF: Record<string, string> = {
  "llm.writeCard": "write-text",
  "image.renderImage": "render-image",
  "mail.sendCard": "deliver",
  "mail.notifySender": "notify-sender",
  "warehouse.insertRows": "insert-opens",
};

function linesFromLedger(entries: LedgerEntry[], running: boolean): FeedLine[] {
  const lines: FeedLine[] = [];
  const oks = new Map<string, number>();
  const fails = new Map<string, number>();
  const calls = [...entries].sort((a, b) => a.at - b.at);
  for (const e of calls) {
    const step = STEP_OF[`${e.provider}.${e.op}`];
    if (!step) continue;
    const map = e.ok ? oks : fails;
    map.set(step, (map.get(step) ?? 0) + 1);
    const nth = oks.get(step) ?? 1;
    const again = step === "write-text" && nth > 1 ? ` again (bill #${nth})` : "";
    lines.push({
      id: `call-${lines.length}`,
      status: e.ok ? "done" : "retrying",
      text: e.ok ? say(step, "done") + again : say(step, "retrying", (fails.get(step) ?? 0) + 1),
    });
  }
  const last = calls.at(-1);
  const lastStep = last ? STEP_OF[`${last.provider}.${last.op}`] : undefined;
  if (running && !(last?.ok && lastStep === "deliver")) {
    // After a failure the whole function starts over; after a success the next call follows.
    const next = !last?.ok ? CHAIN[0] : CHAIN[CHAIN.indexOf(lastStep ?? "") + 1];
    if (next) lines.push({ id: "next", status: "running", text: say(next, "doing") });
  }
  return lines.slice(-9);
}

// ---------- The run trace ----------

export type TraceRow = {
  no: string;
  name: string; // the primitive: step.run, step.invoke ...
  sub: string; // the step id, or what the option does
  status: "done" | "running" | "queued" | "waiting" | "retrying" | "failed";
  at: number; // bar start and length, in % of the run
  len: number;
  time: string;
};

export type TraceView = {
  fn: string;
  state: string;
  runId: string;
  rows: TraceRow[];
};

const PRIMITIVE: Record<string, string> = {
  RUN: "step.run",
  SLEEP: "step.sleep",
  WAIT_FOR_EVENT: "step.waitForEvent",
  WAIT_FOR_SIGNAL: "step.waitForSignal",
  INVOKE: "step.invoke",
  SEND_EVENT: "step.sendEvent",
  AI_GATEWAY: "step.ai",
  STEP: "step.run",
};

const WAITING_TIME: Record<string, string> = {
  SLEEP: "sleeping",
  WAIT_FOR_EVENT: "waiting",
  WAIT_FOR_SIGNAL: "waiting",
  INVOKE: "child run",
};

export function duration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m${Math.round((ms % 60_000) / 1000)}s`;
}

function traceRow(
  step: StepView,
  no: number,
  start: number,
  span: number,
  now: number,
  names: Record<string, string>,
): TraceRow {
  const waits = WAITING_TIME[step.op];
  const status: TraceRow["status"] =
    step.status === "pending"
      ? "queued"
      : step.status === "running" && waits
        ? "waiting"
        : step.status;
  const from = step.startedAt ?? start;
  const to = step.endedAt ?? now;
  const at = Math.min(96, Math.max(0, ((from - start) / span) * 100));
  const len =
    step.status === "pending" ? 0 : Math.min(100 - at, Math.max(2, ((to - from) / span) * 100));
  let time = "queued";
  if (step.status === "done") {
    time = duration(to - from);
    if (step.tries > 1) time += ` ×${step.tries}`;
  } else if (step.status === "running") time = waits ?? "running";
  else if (step.status === "retrying") time = `try ${step.tries}`;
  else if (step.status === "failed") time = step.note === "cancelled" ? "cancelled" : "failed";
  return {
    no: String(no).padStart(2, "0"),
    name: names[step.name] ?? PRIMITIVE[step.op] ?? `step.${step.op.toLowerCase()}`,
    sub: step.name,
    status,
    at: Math.round(at),
    len: Math.round(len),
    time,
  };
}

/** The newest try of a child function's step that is being retried right now, or 0. */
export function childTries(
  runs: RunView[],
  mains: string[],
  childStep: string | undefined,
): number {
  const retrying = runs
    .filter((r) => !mains.includes(r.fn))
    .flatMap((r) => r.steps.filter((s) => s.name === childStep && s.status === "retrying"));
  return Math.max(0, ...retrying.map((s) => s.tries));
}

export function traceOf(
  run: RunView,
  profile: Pick<Profile, "primitives">,
  flow: Profile["flow"],
  problem: boolean,
  now: number,
  childRetry = 0,
): TraceView {
  const start = run.startedAt ?? now;
  const span = Math.max(1, (run.endedAt ?? now) - start);
  const rows: TraceRow[] = [];
  if (flow) {
    // Function options (throttle, debounce ...) are not steps, so the Dev Server has no span for them.
    rows.push({
      no: "fn",
      name: flow.name,
      sub: flow.detail,
      status: problem ? "queued" : "done",
      at: 0,
      len: 0,
      time: problem ? "missing" : "set",
    });
  }
  if (run.steps.length === 0) {
    const status = run.status === "running" ? "running" : run.status === "done" ? "done" : "failed";
    rows.push({
      no: "01",
      name: "function",
      sub: `${run.fn}, no steps`,
      status,
      at: 0,
      len: 100,
      time: status === "running" ? "running" : duration(span),
    });
  }
  run.steps.forEach((step, i) => {
    const row = traceRow(step, i + 1, start, span, now, profile.primitives ?? {});
    if (step.op === "INVOKE" && step.status === "running" && childRetry > 0) {
      // The invoke step is waiting on a child run that is retrying.
      Object.assign(row, { status: "retrying", time: `try ${childRetry}` });
    }
    rows.push(row);
  });
  const waiting = run.status === "running" && rows.some((r) => r.status === "waiting");
  return { fn: run.fn, state: waiting ? "waiting" : run.status, runId: run.id, rows };
}

/** Which run the trace follows: trouble first, then work in progress. Last time's run wins ties. */
export function pickFocus(runs: RunView[], previous: string | null): RunView | null {
  const rank = (run: RunView) => {
    if (run.steps.some((s) => s.status === "retrying" || s.status === "failed")) return 0;
    // A run that is only waiting (for an event, a sleep) is as quiet as a finished one.
    const busy = (s: StepView) => s.status === "running" && !WAITING_TIME[s.op];
    if (run.status === "running")
      return run.steps.some(busy) ? 1 : run.steps.some((s) => s.status !== "pending") ? 2 : 3;
    return 2;
  };
  let best: RunView | null = null;
  for (const run of runs) {
    if (!best) best = run;
    else if (rank(run) < rank(best) || (rank(run) === rank(best) && run.id === previous))
      best = run;
  }
  const keep = runs.find((r) => r.id === previous);
  return keep && best && rank(keep) <= rank(best) ? keep : best;
}
