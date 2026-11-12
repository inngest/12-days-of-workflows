import type { Chaos, LedgerEntry, Scenario } from "@12days/shared";
import type { Inngest } from "inngest";
import { cardBulkSend } from "./src/events.js";

export const lessonBudget = 20;

const recipients = Array.from({ length: 50 }, (_, i) => `guest${i + 1}@example.com`);

// Mail fails once, on the 25th send. retryInMs makes the retry come about 1 s later.
const failsAtTwentyFifth: Chaos = { mail: { afterCalls: 24, failTimes: 1, retryInMs: 1000 } };

async function sendBulk(inngest: Inngest, name: string): Promise<string[]> {
  const { ids } = await inngest.send({
    name,
    data: { cardId: "c1", recipients, chaos: failsAtTwentyFifth },
  });
  return ids;
}

/** How many recipients got the card more than once. */
function duplicateRecipients(ledger: LedgerEntry[]): string[] {
  const seen = new Map<string, number>();
  for (const e of ledger) {
    if (e.provider !== "mail" || e.op !== "sendCard" || !e.ok) continue;
    const to = String(e.meta?.to);
    seen.set(to, (seen.get(to) ?? 0) + 1);
  }
  return [...seen].filter(([, count]) => count > 1).map(([to]) => to);
}

export const scenarios: Record<string, Scenario> = {
  "bulk-50": {
    description: "50 recipients, mail fails once at #25: only that delivery retries",
    send: ({ inngest }) => sendBulk(inngest, cardBulkSend.name),
    expect: {
      settleMs: 30_000,
      runs: [
        { fn: "bulk-send", status: "Completed", count: 1 },
        { fn: "deliver-card", status: "Completed", count: 50 },
      ],
      ledger: { "mail.sendCard": 51 },
      custom: (ledger) => {
        const dupes = duplicateRecipients(ledger);
        return dupes.length === 0 ? null : `${dupes.length} recipients got the card twice`;
      },
    },
  },
  "bulk-50-before": {
    description: "Same failure with one loop in one step: the retry re-sends to the first 24",
    send: ({ inngest }) => sendBulk(inngest, "card/bulk-send.before"),
    expect: {
      settleMs: 30_000,
      runs: [{ fn: "bulk-send-before", status: "Completed", count: 1 }],
      custom: (ledger) => {
        const dupes = duplicateRecipients(ledger);
        return dupes.length >= 20 ? null : `only ${dupes.length} duplicates, expected 20+`;
      },
    },
  },
};
