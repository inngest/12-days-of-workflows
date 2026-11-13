import type { LedgerEntry, Scenario } from "@12days/shared";
import type { Inngest } from "inngest";
import type { CardRequest } from "./src/events.js";

const names = "Alex Bea Cal Dee Eli Fay Gus Hal Ivy Jo Kit Lou Max Nia Oz Pip Quin Rae Sol Tess";

/** "Happy holidays, Alex!" Distinct text per card, so the fakes don't time every card the same. */
const greeting = (cardId: string) => {
  const list = names.split(" ");
  return `Happy holidays, ${list[Number(cardId.slice(1)) % list.length]}!`;
};

const card = (cardId: string, plan: CardRequest["plan"]): CardRequest => ({
  cardId,
  plan,
  prompt: greeting(cardId),
  to: `${cardId}@example.com`,
});

/** 20 free cards in one send, then, once the queue has formed, 2 pro cards. */
async function sendQueue(
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

function deliveryPositions(ledger: LedgerEntry[]): { p1: number; p2: number; total: number } {
  const order = ledger
    .filter((e) => e.provider === "mail" && e.op === "sendCard" && e.ok)
    .map((e) => e.cardId);
  // 1-based, 0 if never delivered
  return { p1: order.indexOf("p1") + 1, p2: order.indexOf("p2") + 1, total: order.length };
}

export const scenarios: Record<string, Scenario> = {
  "pro-arrives-late": {
    description: "20 free cards queue up, then 2 pro cards arrive and jump ahead",
    env: { IMAGE_RATE: "off" },
    send: ({ inngest, sleep }) => sendQueue(inngest, sleep, "card/requested"),
    expect: {
      settleMs: 60_000,
      runs: [{ fn: "create-card", status: "Completed", count: 22 }],
      custom: (ledger) => {
        const { p1, p2 } = deliveryPositions(ledger);
        const ok = p1 >= 1 && p1 <= 6 && p2 >= 1 && p2 <= 6;
        return ok ? null : `pro cards delivered #${p1} and #${p2}, expected both ≤ 6`;
      },
    },
  },
  "pro-arrives-late-before": {
    description: "Same queue with no priority: the pro cards go out last",
    env: { IMAGE_RATE: "off" },
    send: ({ inngest, sleep }) => sendQueue(inngest, sleep, "card/requested.before"),
    expect: {
      settleMs: 60_000,
      runs: [{ fn: "create-card-before", status: "Completed", count: 22 }],
      custom: (ledger) => {
        const { p1, p2, total } = deliveryPositions(ledger);
        const ok = p1 > total - 4 && p2 > total - 4;
        return ok ? null : `pro cards delivered #${p1} and #${p2} of ${total}, expected last 4`;
      },
    },
  },
};
