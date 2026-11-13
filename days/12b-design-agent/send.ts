import { type LedgerEntry, type Scenario, simulateReaction } from "@12days/shared";
import { type CardRequest, cardRequested } from "./src/events.js";

export const lessonBudget = 35;

/** Sandboxes are Inngest Cloud only, so `pnpm check` skips this day's scenarios. */
export const requiresCloudSandboxes = true;

const names = "Alex Bea Cal Dee Eli Fay Gus Hal Ivy Jo Kit Lou Max Nia Oz Pip Quin Rae Sol Tess";

/** "Happy holidays, Alex!" Distinct text per card, so the fakes don't time every card the same. */
const greeting = (cardId: string) => {
  const list = names.split(" ");
  return `Happy holidays, ${list[Number(cardId.slice(1)) % list.length]}!`;
};

const card = (cardId: string): CardRequest => ({
  cardId,
  prompt: greeting(cardId),
  to: `${cardId}@example.com`,
});

/** cardId → variant, read from the LLM calls the experiment made. */
function variantsServed(ledger: LedgerEntry[]): Map<string, string> {
  const served = new Map<string, string>();
  for (const e of ledger) {
    if (e.provider === "llm" && e.op === "designCard" && e.ok && e.cardId)
      served.set(e.cardId, String(e.meta?.variant));
  }
  return served;
}

async function ledger(): Promise<LedgerEntry[]> {
  return (await fetch("http://localhost:3112/__ledger")).json() as Promise<LedgerEntry[]>;
}

const c1 = {
  cardId: "c1",
  prompt: "Happy holidays, Sam!",
  to: "sam@example.com",
};

export const scenarios: Record<string, Scenario> = {
  "design-1": {
    description: "One card (c1) whose first design breaks in the sandbox; the agent revises it",
    env: { REACTION_TTL: "60s" },
    send: async ({ inngest }) => (await inngest.send(cardRequested.create(c1))).ids,
    expect: {
      settleMs: 30_000,
      ledger: { "llm.designCard": 2, "mail.sendCard": 1 },
    },
  },
  "design-4": {
    description: "4 cards split between two designers; each scored when its recipient reacts",
    env: { REACTION_TTL: "60s" },
    send: async ({ inngest, sleep }) => {
      const sent = await inngest.send(
        Array.from({ length: 4 }, (_, i) => cardRequested.create(card(`c${i + 1}`))),
      );
      // Reactions only count once each scorer is waiting, so wait for all 4 deliveries first.
      let entries: LedgerEntry[] = [];
      for (let tries = 0; tries < 120; tries++) {
        entries = await ledger();
        if (entries.filter((e) => e.provider === "mail" && e.ok).length >= 4) break;
        await sleep(500);
      }
      await sleep(2_000);
      const reactions = [...variantsServed(entries)].map(([cardId, variant]) => ({
        name: "card/reacted",
        data: { cardId, loved: simulateReaction(cardId, variant) },
      }));
      const reacted = await inngest.send(reactions);
      return [...sent.ids, ...reacted.ids];
    },
    expect: {
      settleMs: 60_000,
      runs: [{ fn: "score-recipient-reaction", status: "Completed", count: 4 }],
      ledger: { "mail.sendCard": 4 },
    },
  },
};
