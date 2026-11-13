import type { Scenario } from "@12days/shared";
import { type CardRequest, cardRequested } from "./src/events.js";

const card: CardRequest = {
  cardId: "c1",
  prompt: "Happy holidays, Sam!",
  to: "sam@example.com",
};

const grinchCard: CardRequest = { ...card, prompt: "A card from the Grinch" };

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
};
