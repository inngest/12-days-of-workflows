import type { Chaos, Scenario } from "@12days/shared";
import { type CardRequest, cardRequested } from "./src/events.js";

export const lessonBudget = 15;

const card: CardRequest = {
  cardId: "c1",
  prompt: "Happy holidays to the whole team",
  to: "jason@example.com",
};

// retryInMs makes each retry come about 1 s later, so the demo never waits on backoff.
const flakyImage: Chaos = { image: { failTimes: 2, retryInMs: 1000 } };

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
      ledger: { "llm.writeCard": 1, "image.renderImage": 1, "mail.sendCard": 1 },
    },
  },
  "flaky-image": {
    description: "The image API fails twice; steps retry only the image",
    send: async ({ inngest }) => {
      const { ids } = await inngest.send({
        name: cardRequested.name,
        data: { ...card, chaos: flakyImage },
      });
      return ids;
    },
    expect: {
      settleMs: 45_000,
      runs: [{ fn: "create-card", status: "Completed" }],
      ledger: { "llm.writeCard": 1, "image.renderImage": 3, "mail.sendCard": 1 },
    },
  },
  "flaky-image-before": {
    description: "Same failures without steps: the LLM bills on every retry",
    send: async ({ inngest }) => {
      const { ids } = await inngest.send({
        name: "card/requested.before",
        data: { ...card, chaos: flakyImage },
      });
      return ids;
    },
    expect: {
      settleMs: 45_000,
      runs: [{ fn: "create-card-before", status: "Completed" }],
      ledger: { "llm.writeCard": 3, "image.renderImage": 3, "mail.sendCard": 1 },
    },
  },
};
