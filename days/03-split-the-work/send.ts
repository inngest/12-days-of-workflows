import type { Chaos, Scenario } from "@12days/shared";
import { type CardRequest, cardRequested } from "./src/events.js";

export const lessonBudget = 15;

const card: CardRequest = {
  cardId: "c1",
  prompt: "Thanks for a great year, Priya. Happy holidays!",
  to: "priya@example.com",
};

// Five failures outlast the default 4 retries, but not render-card-image's 10.
// retryInMs makes each retry come about 1 s later, so the demo never waits on backoff.
const veryFlakyImage: Chaos = { image: { failTimes: 5, retryInMs: 1000 } };

export const scenarios: Record<string, Scenario> = {
  happy: {
    description: "One card, no failures",
    send: async ({ inngest }) => {
      const { ids } = await inngest.send(cardRequested.create(card));
      return ids;
    },
    expect: {
      settleMs: 10_000,
      runs: [
        { fn: "create-card", status: "Completed" },
        { fn: "render-card-image", status: "Completed" },
      ],
    },
  },
  "very-flaky-image": {
    description: "The image API fails 5 times; its own function retries up to 10",
    send: async ({ inngest }) => {
      const { ids } = await inngest.send({
        name: cardRequested.name,
        data: { ...card, chaos: veryFlakyImage },
      });
      return ids;
    },
    expect: {
      settleMs: 60_000,
      runs: [
        { fn: "create-card", status: "Completed" },
        { fn: "render-card-image", status: "Completed" },
      ],
      ledger: { "image.renderImage": 6, "llm.writeCard": 1, "mail.sendCard": 1 },
    },
  },
  "very-flaky-image-before": {
    description: "Same failures in one function: the default 4 retries run out",
    send: async ({ inngest }) => {
      const { ids } = await inngest.send({
        name: "card/requested.before",
        data: { ...card, chaos: veryFlakyImage },
      });
      return ids;
    },
    expect: {
      settleMs: 60_000,
      runs: [{ fn: "create-card-before", status: "Failed" }],
      ledger: { "mail.sendCard": 0 },
    },
  },
};
