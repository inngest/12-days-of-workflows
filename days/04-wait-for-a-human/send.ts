import type { Scenario } from "@12days/shared";
import { type CardRequest, cardApproved, cardRequested } from "./src/events.js";

export const lessonBudget = 15;

const card: CardRequest = {
  cardId: "c1",
  prompt: "Happy holidays to the whole team",
  to: "jason@example.com",
};

// Text and image take a few seconds; approvals sent before the wait starts are not seen.
const DRAFT_READY_MS = 6_000;

export const scenarios: Record<string, Scenario> = {
  approve: {
    description: "The sender approves the draft: the card goes out",
    env: { DRAFT_TTL: "30s" },
    send: async ({ inngest, sleep }) => {
      const sent = await inngest.send(cardRequested.create(card));
      await sleep(DRAFT_READY_MS);
      const approved = await inngest.send(cardApproved.create({ cardId: "c1" }));
      return [...sent.ids, ...approved.ids];
    },
    expect: {
      settleMs: 5_000,
      runs: [{ fn: "create-card", status: "Completed", output: { status: "delivered" } }],
      ledger: { "mail.sendCard": 1 },
    },
  },
  ignore: {
    description: "Nobody approves: the draft expires and nothing is sent",
    env: { DRAFT_TTL: "5s" },
    send: async ({ inngest }) => {
      const { ids } = await inngest.send(cardRequested.create(card));
      return ids;
    },
    expect: {
      settleMs: 15_000,
      runs: [{ fn: "create-card", status: "Completed", output: { status: "expired" } }],
      ledger: { "mail.sendCard": 0 },
    },
  },
  "approve-wrong-card": {
    description: "An approval for a different card does not release this one",
    env: { DRAFT_TTL: "30s" },
    send: async ({ inngest, sleep }) => {
      const sent = await inngest.send(cardRequested.create(card));
      await sleep(DRAFT_READY_MS);
      const approved = await inngest.send(cardApproved.create({ cardId: "c2" }));
      return [...sent.ids, ...approved.ids];
    },
    expect: {
      settleMs: 4_000,
      runs: [{ fn: "create-card", status: "Running" }],
      ledger: { "mail.sendCard": 0 },
    },
  },
};
