import type { Chaos, Scenario } from "@12days/shared";
import { type CardRequest, cardRequested } from "./src/events.js";

export const lessonBudget = 25;

const card: CardRequest = {
  cardId: "c1",
  prompt: "Happy holidays to the whole team",
  to: "jason@example.com",
};

const grinchCard: CardRequest = { ...card, prompt: "A card from the Grinch" };

const llmRateLimited: Chaos = { llm: { failTimes: 1, status: 429, retryAfterMs: 5000 } };

export const scenarios: Record<string, Scenario> = {
  happy: {
    description: "One card, no failures",
    send: async ({ inngest }) => {
      const { ids } = await inngest.send(cardRequested.create(card));
      return ids;
    },
    expect: {
      settleMs: 8_000,
      runs: [{ fn: "create-card", status: "Completed" }],
    },
  },
  grinch: {
    description: "Moderation rejects the prompt: fail at once and tell the sender",
    send: async ({ inngest }) => {
      const { ids } = await inngest.send(cardRequested.create(grinchCard));
      return ids;
    },
    expect: {
      settleMs: 15_000,
      runs: [{ fn: "create-card", status: "Failed" }],
      ledger: { "mail.notifySender": 1, "llm.writeCard": 0 },
    },
  },
  "grinch-before": {
    description: "Same prompt with a plain Error: Inngest keeps retrying a hopeless card",
    send: async ({ inngest }) => {
      const { ids } = await inngest.send({ name: "card/requested.before", data: grinchCard });
      return ids;
    },
    expect: {
      settleMs: 15_000,
      runs: [{ fn: "create-card-before", status: "Running" }],
      ledger: { "mail.notifySender": 0 },
    },
  },
  "llm-429": {
    description: "The LLM says 429, retry in 5 s: the retry waits exactly that long",
    send: async ({ inngest }) => {
      const { ids } = await inngest.send({
        name: cardRequested.name,
        data: { ...card, chaos: llmRateLimited },
      });
      return ids;
    },
    expect: {
      settleMs: 20_000,
      runs: [{ fn: "create-card", status: "Completed" }],
      ledger: { "llm.writeCard": 2 },
      custom: (ledger) => {
        const calls = ledger.filter((e) => e.provider === "llm" && e.op === "writeCard");
        if (calls.length < 2) return `expected 2 writeCard calls, saw ${calls.length}`;
        // Retries are scheduled to the second, so allow ±1 s. Default backoff would be ≥ 15 s.
        const gap = calls[1].at - calls[0].at;
        if (gap >= 4000 && gap <= 10_000) return null;
        return `second call came ${gap} ms after the first, expected ~5000`;
      },
    },
  },
};
