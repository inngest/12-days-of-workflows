import type { RunView } from "./devserver.js";

// The queue strip: who is being served and who is waiting, for the flow-control days
// (06 concurrency, 10 priority). Built only from the runs: arrival order, the event's plan or
// account, which steps have started, and when each run finished. Nothing is invented.

export type Chip = {
  id: string; // the card id
  group: string; // "pro" or "free" (Day 10), the account id (Day 06)
  state: "waiting" | "serving" | "retrying" | "done";
};

export type Lane = {
  name: string;
  group: string; // which group's cards use this lane ("" = everyone)
  slots: number;
  serving: Chip[];
  waiting: Chip[];
  retrying: Chip[]; // started, then sent back by a failed try: not in a slot, not in line
};

/** A card worth a sentence of its own: the odd one out (the pro card, the other account). */
export type Note = { id: string; group: string; text: string };

export type QueueView = {
  lanes: Lane[];
  done: Chip[];
  notes: Note[];
};

export type QueueRule = {
  by: "plan" | "account";
  /** How many cards a lane serves at once, with and without the fix. */
  slots: { fix: number; problem: number };
  /** Day 06's lanes are one per account; Day 10 has a single line. */
  lanes: "per-group" | "single";
  /** Whether the fix lets one group's cards go first (Day 10's priority). */
  jumps: boolean;
  names: Record<string, string>;
};

const ordinal = (n: number) => {
  const rest = n % 100;
  if (rest >= 11 && rest <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
};
const seconds = (ms: number) => `${Math.max(0, ms / 1000).toFixed(ms < 10_000 ? 1 : 0)} s`;

function groupOf(run: RunView, rule: QueueRule): string {
  const value = run.data[rule.by === "plan" ? "plan" : "accountId"];
  return typeof value === "string" && value ? value : "free";
}

const started = (run: RunView) => run.steps.some((s) => s.status !== "pending");
const trying = (run: RunView) => run.steps.some((s) => s.status === "retrying");

export function queueOf(
  runs: RunView[],
  fn: string,
  rule: QueueRule,
  problem: boolean,
): QueueView | null {
  // Runs arrive oldest first, which is the order the cards came in.
  const cards = runs.filter((r) => r.fn === fn);
  if (cards.length < 2) return null;

  const groups = [...new Set(cards.map((r) => groupOf(r, rule)))];
  const chipOf = (r: RunView): Chip => ({
    id: r.cardId,
    group: groupOf(r, rule),
    state:
      r.status !== "running" ? "done" : trying(r) ? "retrying" : started(r) ? "serving" : "waiting",
  });
  const chips = cards.map(chipOf);

  // The odd one out: the group with the fewest cards. It gets a sentence per card.
  const count = (g: string) => chips.filter((c) => c.group === g).length;
  const rare = groups.length > 1 ? [...groups].sort((a, b) => count(a) - count(b))[0] : "";
  const slots = problem ? rule.slots.problem : rule.slots.fix;
  const perGroup = rule.lanes === "per-group" && !problem;
  const laneOf = (g: string) => (perGroup ? g : "");

  const lanes: Lane[] = (perGroup ? groups : [""]).map((g) => ({
    name: g ? (rule.names[g] ?? g) : (rule.names[""] ?? "Cards"),
    group: g,
    slots,
    serving: chips.filter((c) => c.state === "serving" && laneOf(c.group) === g),
    retrying: chips.filter((c) => c.state === "retrying" && laneOf(c.group) === g),
    // With priority the other group's cards move to the front; otherwise first come, first served.
    waiting: chips
      .filter((c) => c.state === "waiting" && laneOf(c.group) === g)
      .sort((a, b) =>
        rule.jumps && !problem ? Number(b.group === "pro") - Number(a.group === "pro") : 0,
      ),
  }));

  // Finish order, from the runs' own end times.
  const finished = cards
    .filter((r) => r.status !== "running" && r.endedAt !== null)
    .sort((a, b) => (a.endedAt ?? 0) - (b.endedAt ?? 0));

  const notes: Note[] = [];
  for (const run of cards) {
    const chip = chipOf(run);
    if (chip.group !== rare) continue;
    const lane = lanes.find((l) => laneOf(chip.group) === l.group);
    let text: string;
    if (chip.state === "waiting" && lane) {
      const place = lane.waiting.findIndex((c) => c.id === chip.id) + 1;
      const ahead = lane.waiting.length - place;
      text =
        rule.jumps && !problem
          ? `Queued · #${place}, ahead of ${ahead} other card${ahead === 1 ? "" : "s"}`
          : `Queued · #${place} of ${lane.waiting.length}`;
    } else if (chip.state === "serving") {
      const first = run.steps.find((s) => s.startedAt !== null)?.startedAt ?? Date.now();
      text = `Being made now · waited ${seconds(first - (run.queuedAt ?? first))}`;
    } else {
      const first = run.steps.find((s) => s.startedAt !== null)?.startedAt ?? run.endedAt ?? 0;
      const rank = finished.findIndex((f) => f.id === run.id) + 1;
      text = `Delivered ${ordinal(rank)} · waited ${seconds(first - (run.queuedAt ?? first))}`;
    }
    notes.push({ id: chip.id, group: chip.group, text });
  }

  const order = finished.map((r) => r.id);
  const done = cards
    .filter((r) => r.status !== "running")
    .sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id))
    .map(chipOf);
  return { lanes, done, notes };
}
