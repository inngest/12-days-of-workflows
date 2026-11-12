import type { Chaos, LedgerEntry, Scenario } from "@12days/shared";
import type { Inngest } from "inngest";
import type { CardRequest } from "./src/events.js";

export const lessonBudget = 5;

// 15 cards against a provider that allows 5 image calls per 3 seconds (10 s is the real-world
// default; 3 s keeps the demo snappy). Throttle sits at 3: throttle lets one extra start through at the front, so 3 keeps any window under 5.
const env = { IMAGE_RATE: "5/3s" };

// failTimes: 0 means no injected failures; retryInMs only makes the 429 retries come back quickly.
const quickRetries: Chaos = { image: { failTimes: 0, retryInMs: 1000 } };

const card = (n: number): CardRequest => ({
  cardId: `c${n}`,
  prompt: `Holiday card ${n}`,
  to: `c${n}@example.com`,
});

async function sendBurst(inngest: Inngest, name: string, chaos?: Chaos): Promise<string[]> {
  const events = Array.from({ length: 15 }, (_, i) => ({ name, data: { ...card(i + 1), chaos } }));
  const { ids } = await inngest.send(events);
  return ids;
}

const imageCalls = (ledger: LedgerEntry[]) =>
  ledger.filter((e) => e.provider === "image" && e.op === "renderImage");
const delivered = (ledger: LedgerEntry[]) =>
  ledger.filter((e) => e.provider === "mail" && e.op === "sendCard" && e.ok);

export const scenarios: Record<string, Scenario> = {
  burst: {
    description: "15 cards at once: throttle keeps every image call under the limit",
    env,
    send: ({ inngest }) => sendBurst(inngest, "card/requested"),
    expect: {
      settleMs: 45_000,
      runs: [
        { fn: "create-card", status: "Completed", count: 15 },
        { fn: "render-card-image", status: "Completed", count: 15 },
      ],
      ledger: { "image.renderImage": 15 },
      custom: (ledger) => {
        const failed = imageCalls(ledger).filter((e) => !e.ok).length;
        if (failed > 0) return `${failed} image calls failed, expected 0`;
        return delivered(ledger).length === 15 ? null : "expected all 15 cards delivered";
      },
    },
  },
  "burst-before": {
    description: "Same 15 cards, no throttle: a wall of 429s, then retries until all are delivered",
    env,
    send: ({ inngest }) => sendBurst(inngest, "card/requested.before", quickRetries),
    expect: {
      settleMs: 45_000,
      runs: [{ fn: "create-card-before", status: "Completed", count: 15 }],
      custom: (ledger) => {
        const rateLimited = imageCalls(ledger).filter((e) => !e.ok && e.meta?.status === 429);
        if (rateLimited.length === 0) return "expected at least one 429 from the image API";
        return delivered(ledger).length === 15 ? null : "expected all 15 cards delivered";
      },
    },
  },
};
