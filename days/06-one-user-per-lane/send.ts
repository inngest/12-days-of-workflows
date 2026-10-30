import type { LedgerEntry, Scenario } from "@12days/shared";
import type { Inngest } from "inngest";
import type { CardRequest } from "./src/events.js";

export const lessonBudget = 5;

const names = "Alex Bea Cal Dee Eli Fay Gus Hal Ivy Jo Kit Lou Max Nia Oz Pip Quin Rae Sol Tess";

/** "Happy holidays, Alex!" Distinct text per card, so the fakes don't time every card the same. */
const greeting = (cardId: string) => {
  const list = names.split(" ");
  return `Happy holidays, ${list[Number(cardId.slice(1)) % list.length]}!`;
};

const card = (cardId: string, accountId: string): CardRequest => ({
  cardId,
  accountId,
  prompt: greeting(cardId),
  to: `${cardId}@example.com`,
});

/** 20 cards from account a in one send, then, once a's queue has formed, one card from b. */
async function sendBurst(
  inngest: Inngest,
  sleep: (ms: number) => Promise<void>,
  name: string,
): Promise<string[]> {
  const burst = Array.from({ length: 20 }, (_, i) => ({ name, data: card(`a${i + 1}`, "a") }));
  const first = await inngest.send(burst);
  await sleep(2_000);
  const late = await inngest.send({ name, data: card("b1", "b") });
  return [...first.ids, ...late.ids];
}

function deliveryPosition(ledger: LedgerEntry[], cardId: string): number {
  const order = ledger
    .filter((e) => e.provider === "mail" && e.op === "sendCard" && e.ok)
    .map((e) => e.cardId);
  return order.indexOf(cardId) + 1; // 1-based, 0 if never delivered
}

export const scenarios: Record<string, Scenario> = {
  "noisy-neighbor": {
    description: "Account a sends 20 cards, then b sends 1: b gets its own lane",
    env: { IMAGE_RATE: "off" },
    send: ({ inngest, sleep }) => sendBurst(inngest, sleep, "card/requested"),
    expect: {
      settleMs: 60_000,
      runs: [{ fn: "create-card", status: "Completed", count: 21 }],
      custom: (ledger) => {
        const position = deliveryPosition(ledger, "b1");
        return position >= 1 && position <= 6 ? null : `b1 delivered #${position}, expected ≤ 6`;
      },
    },
  },
  "noisy-neighbor-before": {
    description: "Same burst with one shared lane: b waits behind all of a",
    env: { IMAGE_RATE: "off" },
    send: ({ inngest, sleep }) => sendBurst(inngest, sleep, "card/requested.before"),
    expect: {
      settleMs: 60_000,
      runs: [{ fn: "create-card-before", status: "Completed", count: 21 }],
      custom: (ledger) => {
        const position = deliveryPosition(ledger, "b1");
        // b1 lands around #19 of 21; allow slack so step interleaving can't flake the check.
        return position >= 13 ? null : `b1 delivered #${position}, expected after 12+ of a's cards`;
      },
    },
  },
};
