import { type LedgerEntry, type Scenario, simulateReaction } from "@12days/shared";
import { cardReacted, cardRequested } from "./src/events.js";

export const lessonBudget = 35;

const LEDGER_URL = "http://localhost:3013/__ledger";

/** The ledger entries written since `since`, so an earlier `pnpm send` doesn't leak into this one. */
const ledger = async (since: number) =>
  ((await (await fetch(LEDGER_URL)).json()) as LedgerEntry[]).filter((e) => e.at >= since);

/** The cards the agent wrote code for. */
const writtenCards = (entries: LedgerEntry[]) =>
  entries.filter((e) => e.provider === "llm" && e.op === "writeCardCode" && e.ok);

/** Waits (at most 30 s) until all `count` cards are written; returns them. */
async function waitForCards(count: number, since: number, sleep: (ms: number) => Promise<void>) {
  const deadline = Date.now() + 30_000;
  for (;;) {
    const cards = writtenCards(await ledger(since));
    if (cards.length >= count) return cards;
    if (Date.now() > deadline) {
      throw new Error(`Gave up waiting: only ${cards.length} of ${count} cards were written`);
    }
    await sleep(500);
  }
}

export const scenarios: Record<string, Scenario> = {
  "render-20": {
    description:
      "20 cards written as code and rendered in Cloud sandboxes; each recipient reacts (needs SANDBOX_CLOUD=1)",
    // Sandboxes run on Inngest Cloud only, so `pnpm check` skips this unless SANDBOX_CLOUD is set.
    requiresEnv: "SANDBOX_CLOUD",
    // Long on purpose: a scorer can only finish within settleMs if its reaction arrived.
    env: { REACTION_TTL: "5m" },
    send: async ({ inngest, sleep }) => {
      const start = Date.now();
      const requests = Array.from({ length: 20 }, (_, i) =>
        cardRequested.create({
          cardId: `c${i + 1}`,
          prompt: `Holiday card ${i + 1}`,
          to: `c${i + 1}@example.com`,
        }),
      );
      const sent = await inngest.send(requests);

      // A reaction is missed if its scorer isn't waiting yet, so wait for the cards, give the
      // sandboxes a few seconds to render them, then send the reactions twice. Scorers that
      // already heard the first copy ignore the second.
      const cards = await waitForCards(20, start, sleep);
      const reactions = cards.map((e) =>
        cardReacted.create({
          cardId: String(e.cardId),
          loved: simulateReaction(String(e.cardId), "warm"),
        }),
      );
      await sleep(6_000);
      const reacted = await inngest.send(reactions);
      await sleep(3_000);
      const again = await inngest.send(reactions);
      return [...sent.ids, ...reacted.ids, ...again.ids];
    },
    expect: {
      settleMs: 50_000,
      runs: [
        { fn: "create-card", status: "Completed", count: 20 },
        { fn: "score-recipient-reaction", status: "Completed", count: 20 },
      ],
      ledger: { "llm.writeCardCode": 20 },
      custom: (entries) => {
        const broken = writtenCards(entries).filter((e) => e.meta?.broken).length;
        return broken > 0 && broken < 20
          ? null
          : `some, but not all, cards should be broken code, got ${broken} of 20`;
      },
    },
  },
};
