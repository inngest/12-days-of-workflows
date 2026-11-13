import { join } from "node:path";
import type { LedgerEntry } from "@12days/shared";
import express from "express";
import { cleanForm, wavesFor } from "./cards.js";
import {
  type AliveDay,
  clearLedger,
  cloudModeFor,
  findAliveDays,
  fireScenario,
  hasCloudKeys,
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
  cloudFeed,
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

/** Where to watch runs when the day runs in Inngest Cloud (it cannot be shown inside the studio). */
const CLOUD_URL = `https://app.inngest.com/env/${encodeURIComponent(process.env.INNGEST_ENV ?? "production")}/runs`;

/** Said on a day that needs Inngest Cloud when the two keys are not both set. */
const KEYS_MISSING =
  "This day runs in Inngest Cloud. Set INNGEST_SIGNING_KEY and INNGEST_EVENT_KEY, start it with pnpm day {day} --cloud, then restart the studio.";

// ---------- What the studio remembers between requests ----------

// Each side of each day is its own screen, so a tab on the problem route and a tab on the fix
// route never touch each other's runs, cursor, button state or error.
type Side = "problem" | "fix";

/** What was last sent from a screen. */
type Sent = { cardId: string; title: string; to: string; no: string };

type Screen = {
  since: number; // runs queued before this moment are hidden. "Clear" and every send move it forward
  sending: boolean;
  error: string | null;
  sent: Sent | null;
  focusId: string | null;
  acted: boolean; // an action button (approve, delete, react) was pressed for this run
  busy: boolean; // the last read found runs going: the other tab must not wipe the shared ledger
  kept: LedgerEntry[]; // this side's ledger entries, saved when the other side wiped the ledger
};

const screens = new Map<string, Screen>();
let cardNo = 0; // cards sent from any screen: the "No." on the trace

function screenOf(day: string, side: Side): Screen {
  const key = `${day}/${side}`;
  let screen = screens.get(key);
  if (!screen) {
    screen = {
      since: 0,
      sending: false,
      error: null,
      sent: null,
      focusId: null,
      acted: false,
      busy: false,
      kept: [],
    };
    screens.set(key, screen);
  }
  return screen;
}

/** The problem side runs the "-before" functions; everything else is the fix. */
const isBefore = (fn: string | undefined) => fn?.endsWith("-before") ?? false;
const onSide = (side: Side) => (item: { fn?: string }) =>
  isBefore(item.fn) === (side === "problem");

/** A request's side. Days with no "before" only have a fix. */
function sideFor(profile: Profile | undefined, raw: unknown): Side {
  return raw === "problem" && profile?.before !== undefined ? "problem" : "fix";
}

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
  figures: Figure[]; // this side's lesson numbers, for the presenter drawer
  queue: QueueView | null; // who is being served and who waits (Days 06 and 10)
  status: string[]; // the status bar: calm product facts, never lesson figures
  action: string | null; // the label of a button that fits this moment, if any
};

type State = {
  days: AliveDay[];
  day: string | null;
  side: Side;
  /** The day the route asked for, when it is not running. */
  missing: string | null;
  devServer: boolean;
  /** Cloud mode: the day runs in Inngest Cloud. `needed` days without keys show how to set them. */
  cloud: { active: boolean; needed: boolean; url: string; message: string | null };
  profile: PublicProfile | null;
  scenarios: ScenarioInfo[];
  live: Live | null;
  trace: (TraceView & { no: string }) | null;
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
function cardOf(
  profile: Profile,
  tracked: RunView[],
  summary: LedgerSummary,
  mine: Sent | null,
): Live["card"] {
  if (!profile.showsCard) return null;
  const last = summary.lastDelivery;
  const written = tracked.filter(
    (r) => r.status === "done" && typeof (r.output as { text?: string } | null)?.text === "string",
  );
  const wrote = last ? written.find((r) => r.cardId === last.cardId) : written.at(-1);
  if (!last && !wrote) return null;
  return {
    title: mine?.title || last?.prompt || wrote?.data.prompt?.toString() || "Happy holidays",
    message:
      (wrote?.output as { text?: string } | null)?.text ??
      mine?.title ??
      "On its way to the inbox.",
    to: last?.to ?? mine?.to ?? "",
  };
}

async function readState(wanted: string | undefined, wantedSide: unknown): Promise<State> {
  const [days, devServer] = await Promise.all([findAliveDays(), devServerIsUp()]);
  // Day 12b is parked: it is not offered in the day list or picked for "/", but its route works.
  const shown = days.filter((d) => d.nn !== "12b");
  const newest = [...shown].sort((a, b) => b.lastActivity - a.lastActivity)[0];
  // A route names its day: if that day is not running, say so instead of showing another one.
  const active = wanted ? days.find((d) => d.nn === wanted) : newest;
  const side = sideFor(
    wanted ? PROFILES[wanted] : active ? PROFILES[active.nn] : undefined,
    wantedSide,
  );

  const state: State = {
    days: shown,
    day: active?.nn ?? null,
    side,
    missing: wanted && !active ? wanted : null,
    devServer,
    cloud: { active: false, needed: false, url: CLOUD_URL, message: null },
    profile: null,
    scenarios: [],
    live: null,
    trace: null,
    sending: false,
    error: null,
  };
  if (!active) return state;
  const profile = PROFILES[active.nn];
  if (!profile) return state;
  const screen = screenOf(active.nn, side);
  state.sending = screen.sending;
  state.error = screen.error;
  state.profile = publicProfile(active.nn, active.title, profile);
  const cloud = cloudModeFor(active.nn);
  const needed = Boolean(profile.cloudOnly || profile.needsCloud);
  state.cloud = {
    active: cloud,
    needed,
    url: CLOUD_URL,
    message: profile.cloudOnly && !hasCloudKeys() ? KEYS_MISSING.replace("{day}", active.nn) : null,
  };

  const [scenarios, entries, runs] = await Promise.all([
    listScenarios(active.nn).catch(() => []),
    fetchLedger(active.port).catch(() => [] as LedgerEntry[]),
    devServer && !cloud ? readRuns(`day-${active.nn}-`, screen.since).catch(() => []) : [],
  ]);
  state.scenarios = scenarios;

  // The ledger is shared by both tabs: keep to this side's calls, since this side's last send.
  const mine = screen.sent;
  const own = [...screen.kept, ...entries.filter((e) => onSide(side)(e) && e.at >= screen.since)];
  const ownRuns = runs.filter(onSide(side));
  const summary = summarize(own);
  const facts = factsOf(summary, ownRuns, screen.acted);
  const problem = side === "problem";
  const version = problem && profile.before ? profile.before : profile;

  const tracked = ownRuns.filter((r) => version.main.includes(r.fn));
  const started = mine !== null || ownRuns.length > 0;
  // Cloud mode has no runs to read. A card counts as finished once its email went out and the
  // fakes have been quiet for 2 seconds; until then it is still being made.
  const lastCall = Math.max(0, ...own.map((e) => e.at));
  const cloudRunning =
    cloud && started && !screen.error && !(summary.emailsSent > 0 && Date.now() - lastCall > 2000);
  if (cloud) facts.running = cloudRunning ? 1 : 0;
  const figures = proofOf(active.nn, facts);
  const stamp = stampOf(active.nn, facts, problem);

  const focus = pickFocus(tracked, screen.focusId);
  screen.focusId = focus?.id ?? null;
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
      : facts.running > 0 || (ownRuns.length === 0 && !cloud)
        ? "running"
        : facts.failed > 0 && facts.done === 0
          ? "failed"
          : "done",
    problem,
    finished: mainFn.filter((r) => r.status !== "running").length,
    total: mainFn.length,
    feed: !started
      ? []
      : cloud
        ? cloudFeed(own, cloudRunning)
        : feedLines(
            ownRuns,
            version.main,
            version.plan,
            profile.childStep,
            own,
            problem ? undefined : profile.holding,
          ),
    card: started ? cardOf(profile, tracked, summary, mine) : null,
    stamp,
    figures,
    queue: profile.queue ? queueOf(tracked, version.main[0], profile.queue, problem) : null,
    status: statusOf(active.nn, facts, {
      entries: own,
      connected: cloud || state.devServer,
      inProgress: cloud ? facts.running : mainFn.filter((r) => r.status === "running").length,
    }),
    action,
  };
  if (cloud) state.live.status[0] = "Connected to Inngest Cloud";
  if (focus)
    state.trace = {
      ...traceOf(
        focus,
        profile,
        version.flow,
        problem,
        Date.now(),
        childTries(ownRuns, version.main, profile.childStep),
      ),
      no: mine?.no ?? "0000",
    };
  screen.busy = state.live.state === "running" || screen.sending;
  return state;
}

/**
 * Clears one side's screen: its runs still going and its hidden-before line. The ledger is shared
 * by both sides, so it is wiped only when the other side is not mid-run; the other side's finished
 * results are saved first, so its tab keeps showing them.
 */
async function clearScreen(port: number, nn: string, side: Side): Promise<void> {
  const screen = screenOf(nn, side);
  const otherSide: Side = side === "problem" ? "fix" : "problem";
  const other = screenOf(nn, otherSide);
  // Hide the old runs first, so a request that lands mid-clear never mistakes them for new ones.
  const earlier = screen.since;
  screen.since = Date.now();
  screen.focusId = null;
  screen.sent = null;
  screen.acted = false;
  screen.kept = [];
  // Runs in Inngest Cloud are not ours to cancel from here; only this side's runs on the Dev Server.
  const mine = (slug: string) =>
    slug.startsWith(`day-${nn}-`) && isBefore(slug) === (side === "problem");
  if (!cloudModeFor(nn)) await cancelUnfinished(earlier, mine).catch(() => {}); // a stalled Dev Server must not block the clear
  if (!other.busy) {
    const entries = await fetchLedger(port).catch(() => [] as LedgerEntry[]);
    other.kept = [
      ...other.kept,
      ...entries.filter((e) => onSide(otherSide)(e) && e.at >= other.since),
    ];
    await clearLedger(port);
  }
  forgetFinishedRuns();
}

/** Runs `job` as "the send in progress" for one screen: its page shows "Sending..." and any error. */
async function whileSending(screen: Screen, job: () => Promise<void>): Promise<void> {
  screen.sending = true;
  screen.error = null;
  try {
    await job();
  } catch (err) {
    screen.error = err instanceof Error ? err.message : String(err);
  } finally {
    screen.sending = false;
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

// One page per side of a day, so the two can sit in two browser tabs:
//   /day/06/problem   without the lesson      /day/06/fix   with it
// Days with no "before" have a single page, /day/04.
function dayPage(day: string, side: string | undefined, url: string, res: express.Response) {
  const profile = profileOf(day);
  const query = url.includes("?") ? url.slice(url.indexOf("?")) : "";
  if (!profile) return res.redirect(`/${query}`);
  const wanted = profile.before ? (side === "problem" ? "problem" : "fix") : null;
  const path = `/day/${day}${wanted ? `/${wanted}` : ""}`;
  if (`/day/${day}${side ? `/${side}` : ""}` !== path) return res.redirect(`${path}${query}`);
  // `root` keeps a checkout under a dot folder (like .claude/worktrees) from looking hidden.
  res.sendFile("index.html", { root: join(import.meta.dirname, "../public") });
}
app.get("/day/:day", (req, res) => dayPage(req.params.day, undefined, req.url, res));
app.get("/day/:day/:side", (req, res) => dayPage(req.params.day, req.params.side, req.url, res));

app.get("/api/state", async (req, res) => {
  const day = typeof req.query.day === "string" ? req.query.day : undefined;
  res.json(await readState(day, req.query.side));
});

/**
 * Resets one side of a day's screen, ready for a new send. Returns a message when it cannot
 * start. It claims `sending` before its first await, so a double click starts only one.
 */
async function startSend(
  day: string,
  side: Side,
  cardId: string,
  title: string,
  to: string,
): Promise<string | null> {
  const screen = screenOf(day, side);
  if (screen.sending) return "A card is already being sent";
  screen.sending = true;
  try {
    const alive = (await findAliveDays()).find((d) => d.nn === day);
    if (!alive) {
      screen.sending = false;
      return "That day is not running";
    }
    await clearScreen(alive.port, day, side);
    cardNo += 1;
    screen.sent = { cardId, title, to, no: String(cardNo).padStart(4, "0") };
    return null;
  } catch (err) {
    screen.sending = false;
    return err instanceof Error ? err.message : String(err);
  }
}

// The send-a-card form.
app.post("/api/send", async (req, res) => {
  const { day, form } = req.body ?? {};
  const profile = profileOf(day);
  if (!profile) {
    res.status(409).json({ error: "That day cannot send cards here" });
    return;
  }
  if (profile.cloudOnly && !cloudModeFor(day)) {
    res.status(409).json({ error: KEYS_MISSING.replace("{day}", day) });
    return;
  }
  const side = sideFor(profile, req.body?.side);
  const clean = cleanForm(profile, form);
  const cardId = `card-${cardNo + 1}`;
  const waves = wavesFor(day, profile, clean, side === "problem", cardId);
  const refusal = await startSend(day, side, cardId, clean.message ?? "", clean.to ?? "");
  if (refusal) {
    res.status(409).json({ error: refusal });
    return;
  }
  res.status(202).json({ started: true });
  await whileSending(screenOf(day, side), () => sendWaves(day, waves));
});

// The "rush" button, and the presenter's scenario list: both run a scenario from the day's send.ts.
app.post("/api/run", async (req, res) => {
  const { day, scenario } = req.body ?? {};
  const profile = profileOf(day);
  if (!profile || typeof scenario !== "string") {
    res.status(409).json({ error: "Unknown day or scenario" });
    return;
  }
  // The same refusals the page shows, when the day or scenario needs Inngest Cloud and it is off.
  const cloudMessage = KEYS_MISSING.replace("{day}", day);
  if (profile.cloudOnly && !cloudModeFor(day)) {
    res.status(409).json({ error: cloudMessage });
    return;
  }
  const info = (await listScenarios(day).catch(() => [])).find((s) => s.name === scenario);
  if (!info) {
    res.status(409).json({ error: `Day ${day} has no scenario called ${scenario}` });
    return;
  }
  if (info.needsCloud && !cloudModeFor(day)) {
    res.status(409).json({ error: cloudMessage });
    return;
  }
  // A "-before" scenario belongs to the problem tab, every other one to the fix tab.
  const side = sideFor(profile, scenario.endsWith("-before") ? "problem" : "fix");
  const refusal = await startSend(day, side, "", "", "");
  if (refusal) {
    res.status(409).json({ error: refusal });
    return;
  }
  res.status(202).json({ started: true });
  const screen = screenOf(day, side);
  screen.acted = scenario.includes("delete"); // Day 05's scenario deletes the card by itself
  await whileSending(screen, () => fireScenario(day, scenario));
});

// A button that fits the moment: approve the card, delete it, react to it.
app.post("/api/action", async (req, res) => {
  const { day } = req.body ?? {};
  const profile = profileOf(day);
  const action = profile?.action;
  const screen = profile ? screenOf(day, sideFor(profile, req.body?.side)) : undefined;
  if (!action || !screen?.sent?.cardId) {
    res.status(409).json({ error: "Nothing to do right now" });
    return;
  }
  screen.acted = true;
  await sendWaves(day, [
    [{ name: action.event, data: { cardId: screen.sent.cardId, ...action.data } }],
  ]);
  res.status(202).json({ started: true });
});

app.post("/api/clear", async (req, res) => {
  const { day } = req.body ?? {};
  const alive = (await findAliveDays()).find((d) => d.nn === day);
  if (alive) await clearScreen(alive.port, day, sideFor(profileOf(day), req.body?.side));
  res.status(204).end();
});

// Only this machine may reach the studio: its buttons send, cancel and wipe things.
app.listen(PORT, "127.0.0.1", () => {
  console.log(`Holiday Card Studio on http://localhost:${PORT}`);
});
