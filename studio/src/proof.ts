import type { LedgerEntry } from "@12days/shared";
import type { RunView } from "./devserver.js";
import type { LedgerSummary } from "./ledger.js";

// The few numbers that prove each day's lesson, and the stamp that sums up a run.
// Everything here is read from the ledger and the runs, never invented.

export type Facts = LedgerSummary & {
  runs: number;
  running: number;
  done: number;
  failed: number;
  cancelled: number;
  retries: number; // extra attempts across every step of every run
  output: unknown; // what the newest finished run returned
  acted: boolean; // the person pressed a button along the way (approve, delete, react)
};

export function factsOf(ledger: LedgerSummary, runs: RunView[], acted: boolean): Facts {
  const finished = runs.filter((r) => r.status !== "running");
  return {
    ...ledger,
    runs: runs.length,
    running: runs.filter((r) => r.status === "running").length,
    done: runs.filter((r) => r.status === "done").length,
    failed: runs.filter((r) => r.status === "failed").length,
    cancelled: runs.filter((r) => r.status === "cancelled").length,
    retries: runs.reduce(
      (sum, r) => sum + r.steps.reduce((s, step) => s + Math.max(0, step.tries - 1), 0),
      0,
    ),
    output: finished.at(-1)?.output ?? null,
    acted,
  };
}

export type Figure = { value: string; label: string };
type Proof = (f: Facts) => Figure[];

const times = (n: number) => (n === 1 ? "once" : n === 2 ? "twice" : `${n} times`);
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const nth = (n: number) => (n > 0 ? `#${n}` : "not yet");
const position = (f: Facts, id: string) => f.deliveryOrder.indexOf(id) + 1;

const figures: Record<string, Proof> = {
  "01": (f) => [
    { value: `Billed ${times(f.llmCalls)}`, label: "for writing your message" },
    {
      value: plural(f.imageCalls, "artwork attempt"),
      label: "until it worked",
    },
    { value: plural(f.emailsSent, "email"), label: "delivered" },
  ],
  "02": (f) => [
    { value: plural(f.retries, "retry", "retries"), label: "on this card" },
    {
      value: f.notified > 0 ? "Sender notified" : "Sender not notified",
      label: "why the card was rejected",
    },
    {
      value: f.running > 0 ? "Still trying" : f.failed > 0 ? "Stopped at once" : "Finished",
      label: "card status",
    },
  ],
  "03": (f) => [
    {
      value: f.failed > 0 ? "Not delivered" : f.done > 0 ? "Delivered" : "In progress",
      label: "the card",
    },
    { value: plural(f.imageCalls, "artwork attempt"), label: "for this card" },
    { value: plural(f.emailsSent, "email"), label: "delivered" },
  ],
  "05": (f) => [
    {
      value:
        f.cancelled > 0
          ? "Delivery cancelled"
          : f.acted
            ? "Delivery continued"
            : "Delivery on schedule",
      label: f.acted ? "after the card was deleted" : "card not deleted",
    },
    { value: plural(f.emailsSent, "email"), label: "sent to the inbox" },
  ],
  "06": (f) => [
    { value: `Brightside delivered ${nth(position(f, "b1"))}`, label: `of ${f.emailsSent} cards` },
    { value: plural(f.emailsSent, "card"), label: "delivered in all" },
  ],
  "07": (f) => [
    { value: plural(f.rateLimited, "rate-limit error"), label: "from the image service (429)" },
    { value: plural(f.imageCalls, "image request"), label: "to finish the cards" },
    { value: `${f.emailsSent} delivered`, label: "cards in inboxes" },
  ],
  "08": (f) => [
    { value: `Billed ${times(f.llmCalls)}`, label: "for the preview" },
    { value: plural(f.runs, "run"), label: "started by your edits" },
  ],
  "09": (f) => [
    { value: plural(f.duplicates, "duplicate"), label: "cards sent twice" },
    { value: plural(f.emailsSent, "email"), label: "sent in all" },
    { value: plural(f.retries, "retry", "retries"), label: "after a delivery hiccup" },
  ],
  "10": (f) => [
    { value: `Pro card 1 delivered ${nth(position(f, "p1"))}`, label: `of ${f.emailsSent} cards` },
    { value: `Pro card 2 delivered ${nth(position(f, "p2"))}`, label: "same queue" },
  ],
  "11": (f) => [
    { value: plural(f.warehouseWrites, "write"), label: "to the analytics store" },
    { value: plural(f.runs, "run"), label: "started by card opens" },
  ],
};

export function proofOf(nn: string, f: Facts): Figure[] {
  return (figures[nn] ?? (() => []))(f);
}

// ---------- The stamp ----------

const COUNT_WORDS = ["no", "once", "twice", "three times", "four times", "five times"];
const retriedWords = (n: number) => `Retried ${COUNT_WORDS[n] ?? `${n} times`}`;

/** A short verdict, worded like a product, that is true of the run. Null while there is nothing to say. */
export function stampOf(nn: string, f: Facts, problem: boolean): string | null {
  if (f.runs === 0) return null;
  const over = f.running === 0;
  const special: Record<string, () => string | null> = {
    "01": () => (!over ? null : f.llmCalls > 1 ? `Billed ${times(f.llmCalls)}` : "Billed once"),
    "02": () =>
      f.running > 0 && problem
        ? "Still retrying"
        : f.failed > 0 && f.notified > 0
          ? "Rejected at once"
          : null,
    "03": () => (f.failed > 0 ? "Gave up" : over && f.retries > 0 ? retriedWords(f.retries) : null),
    "04": () => {
      const status = (f.output as { status?: string } | null)?.status;
      if (f.running > 0) return "Awaiting approval";
      return status === "expired"
        ? "Approval timed out"
        : status === "delivered"
          ? "Approved"
          : null;
    },
    "05": () =>
      f.cancelled > 0
        ? "Cancelled in time"
        : over && f.emailsSent > 0
          ? f.acted && problem
            ? "Delivered after deletion"
            : "Delivered on time"
          : null,
    "06": () =>
      over && position(f, "b1") > 0 ? `Brightside delivered ${nth(position(f, "b1"))}` : null,
    "07": () =>
      over && f.emailsSent > 0
        ? f.rateLimited > 0
          ? `${f.rateLimited} rate-limit errors`
          : "No rate-limit errors"
        : null,
    "08": () => (over ? (f.llmCalls === 1 ? "Billed once" : `Billed ${times(f.llmCalls)}`) : null),
    "09": () =>
      over && f.emailsSent > 0
        ? f.duplicates === 0
          ? "No duplicates"
          : `${f.duplicates} sent twice`
        : null,
    "10": () =>
      over && position(f, "p1") > 0
        ? position(f, "p1") <= 6
          ? "Pro delivered early"
          : "Pro delivered late"
        : null,
    "11": () => (over && f.warehouseWrites > 0 ? plural(f.warehouseWrites, "write") : null),
    "12": () =>
      over && f.emailsSent > 0
        ? f.emailsSent > 1
          ? `${f.emailsSent} cards compared`
          : f.acted
            ? "Recipient loved it"
            : "Delivered"
        : null,
  };
  const sentence = special[nn]?.() ?? null;
  if (sentence) return sentence;
  if (over && f.retries > 0) return retriedWords(f.retries);
  return null;
}

// ---------- The status bar ----------

type StatusInput = {
  entries: LedgerEntry[];
  connected: boolean;
  inProgress: number; // runs of the day's main function that are still going
};

const clock = (at: number) =>
  new Date(at)
    .toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    .replace(" AM", " am")
    .replace(" PM", " pm");

/**
 * What a real app's status bar would say: calm product wording, nothing about how it works.
 * Read from the runs and the ledger only. The lesson figures above are for the presenter.
 */
export function statusOf(nn: string, f: Facts, input: StatusInput): string[] {
  const items: string[] = [input.connected ? "Connected" : "Reconnecting…"];
  if (f.runs === 0) return items;
  const cards = (n: number) => plural(n, "card");
  const status = (f.output as { status?: string } | null)?.status;
  const sent = input.entries.filter((e) => e.provider === "mail" && e.op === "sendCard" && e.ok);
  const savedRows = input.entries
    .filter((e) => e.provider === "warehouse")
    .reduce((sum, e) => sum + Number(e.meta?.rows ?? 0), 0);

  if (nn === "04" && input.inProgress > 0) items.push("1 card needs your approval");
  else if (nn === "05" && input.inProgress > 0) items.push("1 card scheduled for delivery");
  else if (nn === "12" && input.inProgress > 0) items.push("Waiting for reactions");
  else if (input.inProgress > 0) items.push(`${cards(input.inProgress)} in progress`);

  if (nn === "04" && status === "expired") items.push("1 draft expired, nothing sent");
  if (f.cancelled > 0) items.push("Delivery cancelled");
  if (f.failed > 0) items.push(`${cards(f.failed)} could not be sent`);
  if (nn === "08") items.push(f.running > 0 ? "Saving changes…" : "All changes saved");
  if (nn === "04" && f.running === 0 && status !== "expired") items.push("All changes saved");
  if (nn === "11" && savedRows > 0) items.push(`${plural(savedRows, "card open")} recorded`);

  const last = sent.at(-1);
  if (last && nn !== "11") {
    items.push(`${cards(sent.length)} delivered`);
    items.push(`Last delivery ${clock(last.at)}`);
  }
  return items;
}
