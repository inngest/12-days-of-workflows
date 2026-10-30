import type { Chaos, LedgerEntry, Scenario } from "@12days/shared";
import type { Inngest } from "inngest";

export const lessonBudget = 20;

const recipients = Array.from({ length: 50 }, (_, i) => `friend${i + 1}@example.com`);

// Delivery #25 fails once. retryInMs makes the retry come about 1 s later instead of after
// default backoff, so the demo stays snappy.
const flakyMail: Chaos = { mail: { afterCalls: 24, failTimes: 1, retryInMs: 1000 } };

async function sendBulk(inngest: Inngest, name: string): Promise<string[]> {
  const { ids } = await inngest.send({
    name,
    data: { cardId: "c1", recipients, chaos: flakyMail },
  });
  return ids;
}

/** How many times each recipient was successfully delivered to. */
function deliveriesPerRecipient(ledger: LedgerEntry[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const e of ledger) {
    if (e.provider !== "mail" || e.op !== "sendCard" || !e.ok) continue;
    const to = String(e.meta?.to);
    counts.set(to, (counts.get(to) ?? 0) + 1);
  }
  return counts;
}

export const scenarios: Record<string, Scenario> = {
  "bulk-50": {
    description: "One card to 50 recipients, one event each; delivery #25 fails once",
    send: ({ inngest }) => sendBulk(inngest, "card/bulk-send"),
    expect: {
      settleMs: 30_000,
      runs: [
        { fn: "bulk-send", status: "Completed" },
        { fn: "deliver-card", status: "Completed", count: 50 },
      ],
      ledger: { "mail.sendCard": 51 },
      custom: (ledger) => {
        const counts = deliveriesPerRecipient(ledger);
        const twice = [...counts.values()].filter((n) => n > 1).length;
        if (counts.size !== 50) return `${counts.size} recipients delivered, expected 50`;
        return twice === 0 ? null : `${twice} recipients got the card twice, expected 0`;
      },
    },
  },
  "bulk-50-before": {
    description: "Same send as one loop inside one step: the retry re-sends to the first 24",
    send: ({ inngest }) => sendBulk(inngest, "card/bulk-send.before"),
    expect: {
      settleMs: 30_000,
      runs: [{ fn: "bulk-send-before", status: "Completed" }],
      custom: (ledger) => {
        const twice = [...deliveriesPerRecipient(ledger).values()].filter((n) => n > 1).length;
        return twice >= 20 ? null : `${twice} recipients got the card twice, expected 20+`;
      },
    },
  },
};
