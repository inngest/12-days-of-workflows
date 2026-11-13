import type { LedgerEntry, Scenario } from "@12days/shared";
import type { Inngest } from "inngest";

/** 120 opens across 30 cards, sent in 12 sends of 10 over about 2 s. */
async function sendOpens(
  inngest: Inngest,
  sleep: (ms: number) => Promise<void>,
  name: string,
): Promise<string[]> {
  const ids: string[] = [];
  for (let send = 0; send < 12; send++) {
    const events = Array.from({ length: 10 }, (_, i) => ({
      name,
      data: { cardId: `c${((send * 10 + i) % 30) + 1}`, openedAt: new Date().toISOString() },
    }));
    ids.push(...(await inngest.send(events)).ids);
    await sleep(180);
  }
  return ids;
}

const inserts = (ledger: LedgerEntry[]) =>
  ledger.filter((e) => e.provider === "warehouse" && e.op === "insertRows");

export const scenarios: Record<string, Scenario> = {
  "opens-120": {
    description: "120 card opens in 2 s, batched: a handful of warehouse writes",
    send: ({ inngest, sleep }) => sendOpens(inngest, sleep, "card/opened"),
    expect: {
      settleMs: 20_000,
      runs: [{ fn: "record-opens", status: "Completed" }],
      custom: (ledger) => {
        const writes = inserts(ledger);
        const rows = writes.reduce((sum, e) => sum + Number(e.meta?.rows ?? 0), 0);
        if (rows !== 120) return `${rows} rows inserted, expected 120`;
        return writes.length <= 4 ? null : `${writes.length} warehouse writes, expected ≤ 4`;
      },
    },
  },
  "opens-120-before": {
    description: "Same opens with no batching: 120 runs, 120 billed writes",
    send: ({ inngest, sleep }) => sendOpens(inngest, sleep, "card/opened.before"),
    expect: {
      settleMs: 30_000,
      runs: [{ fn: "record-opens-before", status: "Completed", count: 120 }],
      ledger: { "warehouse.insertRows": 120 },
    },
  },
};
