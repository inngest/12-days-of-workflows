import type { LedgerEntry, Scenario } from "@12days/shared";
import type { Inngest } from "inngest";
import type { CardRequest } from "./src/events.js";

export const lessonBudget = 5;

const card = (cardId: string): CardRequest => ({
  cardId,
  prompt: `Holiday card ${cardId}`,
  to: `${cardId}@example.com`,
});

/** 15 cards in one send. The image provider allows 5 calls per 10 s (IMAGE_RATE default). */
async function sendBurst(inngest: Inngest, name: string): Promise<string[]> {
  const burst = Array.from({ length: 15 }, (_, i) => ({ name, data: card(`c${i + 1}`) }));
  const { ids } = await inngest.send(burst);
  return ids;
}

const rateLimited = (ledger: LedgerEntry[]) =>
  ledger.filter((e) => e.provider === "image" && !e.ok && e.meta?.status === 429).length;

export const scenarios: Record<string, Scenario> = {
  burst: {
    description: "15 cards at once; renders are throttled to the provider's 5 per 10 s",
    send: ({ inngest }) => sendBurst(inngest, "card/requested"),
    expect: {
      settleMs: 60_000,
      runs: [
        { fn: "create-card", status: "Completed", count: 15 },
        { fn: "render-card-image", status: "Completed", count: 15 },
      ],
      ledger: { "image.renderImage": 15, "mail.sendCard": 15 },
      custom: (ledger) => {
        const failed = rateLimited(ledger);
        return failed === 0 ? null : `${failed} image calls got a 429, expected 0`;
      },
    },
  },
  "burst-before": {
    description: "Same burst with no throttle: a wall of 429s, then slow retries",
    send: ({ inngest }) => sendBurst(inngest, "card/requested.before"),
    expect: {
      // The 429 wall shows up within seconds; the retries behind it take minutes of backoff.
      settleMs: 15_000,
      custom: (ledger) => {
        const failed = rateLimited(ledger);
        return failed >= 1 ? null : "expected at least one image call to get a 429";
      },
    },
  },
};
