import type { LedgerEntry, Scenario } from "@12days/shared";
import type { Inngest } from "inngest";
import type { CardRequest } from "./src/events.js";

export const lessonBudget = 5;

const card = (cardId: string, plan: CardRequest["plan"]): CardRequest => ({
  cardId,
  plan,
  prompt: `Holiday card ${cardId}`,
  to: `${cardId}@example.com`,
});

/** 20 free cards in one send, then, once the queue has formed, two pro cards. */
async function sendProLate(
  inngest: Inngest,
  sleep: (ms: number) => Promise<void>,
  name: string,
): Promise<string[]> {
  const free = Array.from({ length: 20 }, (_, i) => ({ name, data: card(`f${i + 1}`, "free") }));
  const first = await inngest.send(free);
  await sleep(2_000);
  const pro = await inngest.send([
    { name, data: card("p1", "pro") },
    { name, data: card("p2", "pro") },
  ]);
  return [...first.ids, ...pro.ids];
}

function deliveryPosition(ledger: LedgerEntry[], cardId: string): number {
  const order = ledger
    .filter((e) => e.provider === "mail" && e.op === "sendCard" && e.ok)
    .map((e) => e.cardId);
  return order.indexOf(cardId) + 1; // 1-based, 0 if never delivered
}

export const scenarios: Record<string, Scenario> = {
  "pro-arrives-late": {
    description: "20 free cards queue up, then 2 pro cards arrive: pro goes out first",
    env: { IMAGE_RATE: "off" },
    send: ({ inngest, sleep }) => sendProLate(inngest, sleep, "card/requested"),
    expect: {
      settleMs: 60_000,
      runs: [{ fn: "create-card", status: "Completed", count: 22 }],
      custom: (ledger) => {
        for (const id of ["p1", "p2"]) {
          const position = deliveryPosition(ledger, id);
          if (position < 1 || position > 6) return `${id} delivered #${position}, expected ≤ 6`;
        }
        return null;
      },
    },
  },
  "pro-arrives-late-before": {
    description: "Same queue with no priority: pro cards wait behind every free card",
    env: { IMAGE_RATE: "off" },
    send: ({ inngest, sleep }) => sendProLate(inngest, sleep, "card/requested.before"),
    expect: {
      settleMs: 60_000,
      runs: [{ fn: "create-card-before", status: "Completed", count: 22 }],
      custom: (ledger) => {
        for (const id of ["p1", "p2"]) {
          const position = deliveryPosition(ledger, id);
          if (position < 19) return `${id} delivered #${position}, expected among the last 4`;
        }
        return null;
      },
    },
  },
};
