import { type LedgerEntry, type Scenario, simulateReaction } from "@12days/shared";
import { type CardRequest, cardRequested } from "./src/events.js";

export const lessonBudget = 35;

const card = (cardId: string): CardRequest => ({
  cardId,
  prompt: `Holiday card ${cardId}`,
  to: `${cardId}@example.com`,
});

/** cardId → variant, read from the LLM calls the experiment made. */
function variantsServed(ledger: LedgerEntry[]): Map<string, string> {
  const served = new Map<string, string>();
  for (const e of ledger) {
    if (e.provider === "llm" && e.ok && e.cardId) served.set(e.cardId, String(e.meta?.variant));
  }
  return served;
}

async function ledger(): Promise<LedgerEntry[]> {
  return (await fetch("http://localhost:3012/__ledger")).json() as Promise<LedgerEntry[]>;
}

export const scenarios: Record<string, Scenario> = {
  "experiment-40": {
    description: "40 cards split between two tones; each scored when its recipient reacts",
    env: { REACTION_TTL: "60s" },
    send: async ({ inngest, sleep }) => {
      const sent = await inngest.send(
        Array.from({ length: 40 }, (_, i) => cardRequested.create(card(`c${i + 1}`))),
      );
      // Reactions only count once each scorer is waiting, so wait for all 40 deliveries first.
      let entries: LedgerEntry[] = [];
      for (let tries = 0; tries < 60; tries++) {
        entries = await ledger();
        if (entries.filter((e) => e.provider === "mail" && e.ok).length >= 40) break;
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
      settleMs: 45_000,
      // The Dev Server reports a parent run as Running again once its deferred score lands
      // (beta), so create-card is checked through the ledger instead. See SPEC "Day 12 surface".
      runs: [{ fn: "score-recipient-reaction", status: "Completed", count: 40 }],
      ledger: { "llm.writeCard": 40, "mail.sendCard": 40 },
      custom: (ledger) => {
        const counts = { classic: 0, warm: 0 } as Record<string, number>;
        for (const variant of variantsServed(ledger).values()) counts[variant]++;
        const ok = counts.classic >= 10 && counts.warm >= 10;
        return ok ? null : `variants served ${JSON.stringify(counts)}, expected ≥ 10 each`;
      },
    },
  },
};
