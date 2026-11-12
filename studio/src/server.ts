import { join } from "node:path";
import type { LedgerEntry } from "@12days/shared";
import express from "express";
import { cleanForm, wavesFor } from "./cards.js";
import {
  type AliveDay,
  clearLedger,
  findAliveDays,
  fireScenario,
  listScenarios,
  type ScenarioInfo,
  sendWaves,
} from "./days.js";
import {
  cancelUnfinished,
  devServerIsUp,
  forgetFinishedRuns,
  type RunView,
  readRuns,
} from "./devserver.js";
import {
  childTries,
  type FeedLine,
  feedLines,
  pickFocus,
  type TraceView,
  traceOf,
} from "./feed.js";
import { fetchLedger, type LedgerSummary, summarize } from "./ledger.js";
import { FIELDS, type Field, type FieldId, PROFILES, type Profile } from "./profiles.js";
import { type Figure, factsOf, proofOf, stampOf, statusOf } from "./proof.js";
import { type QueueView, queueOf } from "./queue.js";

const PORT = Number(process.env.STUDIO_PORT ?? 3100);

// ---------- What the studio remembers between requests ----------

// Runs queued before this moment are hidden. "Clear" and every send move it forward.
let since = 0;
let sending = false;
let sendError: string | null = null;
let cardNo = 0; // cards sent from this screen: the "No." on the trace

/** What was last sent from this screen. */
type Sent = { day: string; problem: boolean; cardId: string; title: string; to: string };
let sent: Sent | null = null;
let focusId: string | null = null;
let acted = false; // an action button (approve, delete, react) was pressed for this run

/** The last result of each side, per day. The ledger is wiped on every send, so we keep a copy. */
type Snapshot = {
  figures: Figure[];
  stamp: string | null;
  settled: boolean;
  finished: boolean; // false while the run is still going
  interrupted?: boolean; // the other side started before this run finished
};
const snapshots = new Map<string, { problem?: Snapshot; fix?: Snapshot }>();
let quiet = { key: "", since: 0 }; // when the numbers last changed: a run is "settled" after 2 quiet seconds

// ---------- One second of state ----------

type PublicField = Field & { id: string };
type PublicProfile = {
  nn: string;
  title: string;
  fields: PublicField[];
  defaults: Profile["defaults"];
  hasContrast: boolean;
  cloudOnly: boolean;
  shortcut: Profile["shortcut"] | null;
  actionLabel: string | null;
  tip: string | null;
  showsCard: boolean;
};

type Live = {
  state: "idle" | "running" | "done" | "failed";
  problem: boolean;
  finished: number;
  total: number;
  feed: FeedLine[];
  card: { title: string; message: string; to: string } | null;
  stamp: string | null;
  queue: QueueView | null; // who is being served and who waits (Days 06 and 10)
  status: string[]; // the status bar: calm product facts, never lesson figures
  action: string | null; // the label of a button that fits this moment, if any
};

type State = {
  days: AliveDay[];
  day: string | null;
  devServer: boolean;
  profile: PublicProfile | null;
  scenarios: ScenarioInfo[];
  live: Live | null;
  trace: (TraceView & { no: string }) | null;
  compare: { problem: Snapshot | null; fix: Snapshot | null };
  sending: boolean;
  error: string | null;
};

function publicProfile(nn: string, title: string, profile: Profile): PublicProfile {
  const fields = profile.fields.map((id: FieldId): PublicField => {
    if (id !== "trouble") return { id, ...FIELDS[id] };
    const t = profile.trouble ?? { label: "Trouble", off: "None", on: "Some" };
    return {
      id,
      label: t.label,
      kind: "select",
      options: [
        ["off", t.off],
        ["on", t.on],
      ],
    };
  });
  return {
    nn,
    title,
    fields,
    defaults: profile.defaults,
    hasContrast: profile.before !== undefined,
    cloudOnly: profile.cloudOnly ?? false,
    shortcut: profile.shortcut ?? null,
    actionLabel: profile.action?.label ?? null,
    tip: profile.tip ?? null,
    showsCard: profile.showsCard,
  };
}

/** The card shown once something has been delivered (or, for previews, written). */
function cardOf(profile: Profile, tracked: RunView[], summary: LedgerSummary): Live["card"] {
  if (!profile.showsCard) return null;
  const last = summary.lastDelivery;
  const written = tracked.filter(
    (r) => r.status === "done" && typeof (r.output as { text?: string } | null)?.text === "string",
  );
  const wrote = last ? written.find((r) => r.cardId === last.cardId) : written.at(-1);
  if (!last && !wrote) return null;
  const mine = sent?.title ? sent : null;
  return {
    title: mine?.title || last?.prompt || wrote?.data.prompt?.toString() || "Happy holidays",
    message:
      (wrote?.output as { text?: string } | null)?.text ??
      mine?.title ??
      "On its way to the inbox.",
    to: last?.to ?? mine?.to ?? "",
  };
}

/**
 * Keeps the latest numbers for the side that is running, until its run settles (nothing running
 * and nothing changing for 2 seconds). After that the copy is frozen, so the other side's run
 * cannot touch it.
 */
function remember(
  nn: string,
  problem: boolean,
  entry: Pick<Snapshot, "figures" | "stamp">,
  key: string,
  over: boolean,
) {
  const side = problem ? "problem" : "fix";
  const stored = snapshots.get(nn) ?? {};
  if (stored[side]?.settled) return;
  if (quiet.key !== key) quiet = { key, since: Date.now() };
  const settled = over && Date.now() - quiet.since >= 2000;
  snapshots.set(nn, { ...stored, [side]: { ...entry, settled, finished: over } });
}

async function readState(wanted: string | undefined): Promise<State> {
  const [days, devServer] = await Promise.all([findAliveDays(), devServerIsUp()]);
  const newest = [...days].sort((a, b) => b.lastActivity - a.lastActivity)[0];
  const active = days.find((d) => d.nn === wanted) ?? newest;

  const state: State = {
    days,
    day: active?.nn ?? null,
    devServer,
    profile: null,
    scenarios: [],
    live: null,
    trace: null,
    compare: { problem: null, fix: null },
    sending,
    error: sendError,
  };
  if (!active) return state;
  const profile = PROFILES[active.nn];
  if (!profile) return state;
  state.profile = publicProfile(active.nn, active.title, profile);

  const [scenarios, entries, runs] = await Promise.all([
    listScenarios(active.nn).catch(() => []),
    fetchLedger(active.port).catch(() => [] as LedgerEntry[]),
    devServer ? readRuns(`day-${active.nn}-`, since).catch(() => []) : [],
  ]);
  state.scenarios = scenarios;

  const summary = summarize(entries);
  const facts = factsOf(summary, runs, acted);
  const mine = sent?.day === active.nn ? sent : null;
  const problem = mine?.problem ?? runs.some((r) => profile.before?.main.includes(r.fn));
  const version = problem && profile.before ? profile.before : profile;

  const tracked = runs.filter((r) => version.main.includes(r.fn));
  const started = mine !== null || runs.length > 0;
  const figures = proofOf(active.nn, facts);
  const stamp = stampOf(active.nn, facts, problem);

  if (started && runs.length > 0) {
    const key = `${active.nn}:${runs.length}:${facts.running}:${entries.length}`;
    remember(active.nn, problem, { figures, stamp }, key, !sending && facts.running === 0);
  }
  const stored = snapshots.get(active.nn);
  state.compare = { problem: stored?.problem ?? null, fix: stored?.fix ?? null };

  const focus = pickFocus(tracked, focusId);
  focusId = focus?.id ?? null;
  const waitingOn = profile.action?.when;
  const action =
    waitingOn &&
    mine?.cardId &&
    tracked.some((r) => r.steps.some((s) => s.name === waitingOn && s.status === "running"))
      ? (profile.action?.label ?? null)
      : null;
  const mainFn = tracked.filter((r) => r.fn === version.main[0]);

  state.live = {
    state: !started
      ? "idle"
      : facts.running > 0 || runs.length === 0
        ? "running"
        : facts.failed > 0 && facts.done === 0
          ? "failed"
          : "done",
    problem,
    finished: mainFn.filter((r) => r.status !== "running").length,
    total: mainFn.length,
    feed: started
      ? feedLines(
          runs,
          version.main,
          version.plan,
          profile.childStep,
          entries,
          problem ? undefined : profile.holding,
        )
      : [],
    card: started ? cardOf(profile, tracked, summary) : null,
    stamp,
    queue: profile.queue ? queueOf(tracked, version.main[0], profile.queue, problem) : null,
    status: statusOf(active.nn, facts, {
      entries,
      connected: state.devServer,
      inProgress: mainFn.filter((r) => r.status === "running").length,
    }),
    action,
  };
  if (focus)
    state.trace = {
      ...traceOf(
        focus,
        profile,
        version.flow,
        problem,
        Date.now(),
        childTries(runs, version.main, profile.childStep),
      ),
      no: String(cardNo).padStart(4, "0"),
    };
  return state;
}

/** Clears the screen: ledger, Dev Server runs still going, and the hidden-before line. */
async function clearScreen(port: number): Promise<void> {
  // Hide the old runs first, so a request that lands mid-clear never mistakes them for new ones.
  const earlier = since;
  since = Date.now();
  focusId = null;
  quiet = { key: "", since: 0 };
  sent = null;
  acted = false;
  await cancelUnfinished(earlier).catch(() => {}); // a stalled Dev Server must not block the clear
  await clearLedger(port);
  forgetFinishedRuns();
}

/** Runs `job` as "the send in progress": the page shows "Sending..." and any error. */
async function whileSending(job: () => Promise<void>): Promise<void> {
  sending = true;
  sendError = null;
  try {
    await job();
  } catch (err) {
    sendError = err instanceof Error ? err.message : String(err);
  } finally {
    sending = false;
  }
}

// ---------- Routes ----------

/** The profile for a day id from a request, or undefined for anything that is not a day. */
function profileOf(day: unknown): Profile | undefined {
  return typeof day === "string" && Object.hasOwn(PROFILES, day) ? PROFILES[day] : undefined;
}

const app = express();
app.use(express.json());
app.use("/ui", express.static(join(import.meta.dirname, "../../ui")));
app.use(express.static(join(import.meta.dirname, "../public")));

app.get("/api/state", async (req, res) => {
  const day = typeof req.query.day === "string" ? req.query.day : undefined;
  res.json(await readState(day));
});

/**
 * Resets a day's screen and unfreezes its numbers, ready for a new send. Returns a message when
 * it cannot start. It claims `sending` before its first await, so a double click starts only one.
 */
async function startSend(
  day: string,
  problem: boolean,
  cardId: string,
  title: string,
  to: string,
): Promise<string | null> {
  if (sending) return "A card is already being sent";
  sending = true;
  try {
    const alive = (await findAliveDays()).find((d) => d.nn === day);
    if (!alive) {
      sending = false;
      return "That day is not running";
    }
    const prior =
      sent?.day === day ? snapshots.get(day)?.[sent.problem ? "problem" : "fix"] : undefined;
    await clearScreen(alive.port);
    if (prior && !prior.finished) prior.interrupted = true; // starting again cut that run short
    cardNo += 1;
    sent = { day, problem, cardId, title, to };
    const stored = snapshots.get(day)?.[problem ? "problem" : "fix"];
    if (stored) Object.assign(stored, { settled: false, interrupted: false }); // follows the new run
    return null;
  } catch (err) {
    sending = false;
    return err instanceof Error ? err.message : String(err);
  }
}

// The send-a-card form.
app.post("/api/send", async (req, res) => {
  const { day, problem, form } = req.body ?? {};
  const profile = profileOf(day);
  if (!profile || profile.cloudOnly) {
    res.status(409).json({ error: "That day cannot send cards here" });
    return;
  }
  const clean = cleanForm(profile, form);
  const cardId = `card-${cardNo + 1}`;
  const useBefore = problem === true && profile.before !== undefined;
  const waves = wavesFor(day, profile, clean, useBefore, cardId);
  const refusal = await startSend(day, useBefore, cardId, clean.message ?? "", clean.to ?? "");
  if (refusal) {
    res.status(409).json({ error: refusal });
    return;
  }
  res.status(202).json({ started: true });
  await whileSending(() => sendWaves(day, waves));
});

// The "rush" button, and the presenter's scenario list: both run a scenario from the day's send.ts.
app.post("/api/run", async (req, res) => {
  const { day, scenario } = req.body ?? {};
  const profile = profileOf(day);
  if (!profile || typeof scenario !== "string") {
    res.status(409).json({ error: "Unknown day or scenario" });
    return;
  }
  // The same refusals the page shows: Cloud-only days and scenarios cannot run on this machine.
  const cloudMessage = "That scenario needs Inngest Cloud, so it cannot run here";
  if (profile.cloudOnly) {
    res.status(409).json({ error: cloudMessage });
    return;
  }
  const info = (await listScenarios(day).catch(() => [])).find((s) => s.name === scenario);
  if (!info) {
    res.status(409).json({ error: `Day ${day} has no scenario called ${scenario}` });
    return;
  }
  if (info.needsCloud) {
    res.status(409).json({ error: cloudMessage });
    return;
  }
  const refusal = await startSend(day, scenario.endsWith("-before"), "", "", "");
  if (refusal) {
    res.status(409).json({ error: refusal });
    return;
  }
  res.status(202).json({ started: true });
  acted = scenario.includes("delete"); // Day 05's scenario deletes the card by itself
  await whileSending(() => fireScenario(day, scenario));
});

// A button that fits the moment: approve the card, delete it, react to it.
app.post("/api/action", async (req, res) => {
  const { day } = req.body ?? {};
  const action = profileOf(day)?.action;
  if (!action || !sent || sent.day !== day || !sent.cardId) {
    res.status(409).json({ error: "Nothing to do right now" });
    return;
  }
  acted = true;
  await sendWaves(day, [[{ name: action.event, data: { cardId: sent.cardId, ...action.data } }]]);
  res.status(202).json({ started: true });
});

app.post("/api/clear", async (req, res) => {
  const { day } = req.body ?? {};
  const alive = (await findAliveDays()).find((d) => d.nn === day);
  if (alive) await clearScreen(alive.port);
  snapshots.delete(day);
  res.status(204).end();
});

// Only this machine may reach the studio: its buttons send, cancel and wipe things.
app.listen(PORT, "127.0.0.1", () => {
  console.log(`Holiday Card Studio on http://localhost:${PORT}`);
});
