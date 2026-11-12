import { type LedgerEntry, type Scenario, simulateReaction } from "@12days/shared";
import { cardReacted, cardRequested } from "./src/events.js";

export const lessonBudget = 35;

const LEDGER_URL = "http://localhost:3012/__ledger";

/** The ledger entries written since `since`, so an earlier `pnpm send` doesn't leak into this one. */
const ledger = async (since: number) =>
  ((await (await fetch(LEDGER_URL)).json()) as LedgerEntry[]).filter((e) => e.at >= since);

const variantOf = (e: LedgerEntry) => String(e.meta?.variant);

/** The cards that were written, with the tone each one got. */
const writtenCards = (entries: LedgerEntry[]) =>
  entries.filter((e) => e.provider === "llm" && e.op === "writeCard" && e.ok);

const deliveredCards = (entries: LedgerEntry[]) =>
  entries.filter((e) => e.provider === "mail" && e.op === "sendCard" && e.ok);

/** Waits (at most 30 s) until all `count` cards are written and delivered; returns the written ones. */
async function waitForCards(count: number, since: number, sleep: (ms: number) => Promise<void>) {
  const deadline = Date.now() + 30_000;
  for (;;) {
    const entries = await ledger(since);
    const cards = writtenCards(entries);
    if (cards.length >= count && deliveredCards(entries).length >= count) return cards;
    if (Date.now() > deadline) {
      throw new Error(`Gave up waiting: only ${cards.length} of ${count} cards were written`);
    }
    await sleep(500);
  }
}

export const scenarios: Record<string, Scenario> = {
  "experiment-40": {
    description: "40 cards split between warm and classic; each recipient reacts; warm pulls ahead",
    // Long on purpose: a scorer can only finish within settleMs if its reaction arrived.
    env: { REACTION_TTL: "5m" },
    send: async ({ inngest, sleep }) => {
      const start = Date.now();
      const requests = Array.from({ length: 40 }, (_, i) =>
        cardRequested.create({
          cardId: `c${i + 1}`,
          prompt: `Holiday card ${i + 1}`,
          to: `c${i + 1}@example.com`,
        }),
      );
      const sent = await inngest.send(requests);

      // A reaction is missed if its scorer isn't waiting yet, so wait for the cards to be
      // delivered (that starts the scorers), then send the reactions twice. Scorers that already
      // heard the first copy ignore the second.
      const cards = await waitForCards(40, start, sleep);
      const reactions = cards.map((e) =>
        cardReacted.create({
          cardId: String(e.cardId),
          loved: simulateReaction(String(e.cardId), variantOf(e)),
        }),
      );
      await sleep(2_000);
      const reacted = await inngest.send(reactions);
      await sleep(3_000);
      const again = await inngest.send(reactions);
      return [...sent.ids, ...reacted.ids, ...again.ids];
    },
    expect: {
      settleMs: 40_000,
      runs: [
        { fn: "create-card", status: "Completed", count: 40 },
        { fn: "score-recipient-reaction", status: "Completed", count: 40 },
      ],
      ledger: { "llm.writeCard": 40, "mail.sendCard": 40 },
      custom: (entries) => {
        const served = (variant: string) =>
          writtenCards(entries).filter((e) => variantOf(e) === variant).length;
        const [warm, classic] = [served("warm"), served("classic")];
        return warm >= 10 && classic >= 10
          ? null
          : `each variant should be served at least 10 times, got warm ${warm}, classic ${classic}`;
      },
    },
  },
};
