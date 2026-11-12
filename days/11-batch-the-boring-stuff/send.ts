import type { LedgerEntry, Scenario } from "@12days/shared";
import type { Inngest } from "inngest";
import { cardOpened } from "./src/events.js";

export const lessonBudget = 10;

/** 120 opens in six sends of 20, spread over about 2 seconds. */
async function sendOpens(
  inngest: Inngest,
  sleep: (ms: number) => Promise<void>,
  name: string,
): Promise<string[]> {
  const ids: string[] = [];
  for (let wave = 0; wave < 6; wave++) {
    const opens = Array.from({ length: 20 }, (_, i) => ({
      name,
      data: { cardId: `c${wave * 20 + i + 1}`, openedAt: new Date().toISOString() },
    }));
    ids.push(...(await inngest.send(opens)).ids);
    if (wave < 5) await sleep(400);
  }
  return ids;
}

const writes = (ledger: LedgerEntry[]) =>
  ledger.filter((e) => e.provider === "warehouse" && e.op === "insertRows");

export const scenarios: Record<string, Scenario> = {
  "opens-120": {
    description: "120 opens in 2 s become three warehouse writes (50, 50, 20)",
    send: ({ inngest, sleep }) => sendOpens(inngest, sleep, cardOpened.name),
    expect: {
      settleMs: 30_000,
      runs: [{ fn: "record-opens", status: "Completed" }],
      custom: (ledger) => {
        const rows = writes(ledger).map((e) => Number(e.meta?.rows));
        const total = rows.reduce((sum, n) => sum + n, 0);
        if (rows.length > 4) return `${rows.length} writes, expected 4 or fewer`;
        if (Math.max(...rows) > 50) return "a batch held more than 50 rows";
        return total === 120 ? null : `${total} rows written, expected 120`;
      },
    },
  },
  "opens-120-before": {
    description: "Same 120 opens, one run each: 120 billed writes",
    send: ({ inngest, sleep }) => sendOpens(inngest, sleep, "card/opened.before"),
    expect: {
      settleMs: 60_000,
      runs: [{ fn: "record-open-before", status: "Completed", count: 120 }],
      ledger: { "warehouse.insertRows": 120 },
    },
  },
};
