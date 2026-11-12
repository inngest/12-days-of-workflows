import { nextCallNumber, record } from "../ledger.js";
import { sleep } from "./seed.js";

export async function insertRows(table: string, rows: object[]): Promise<{ inserted: number }> {
  const call = nextCallNumber("warehouse", table);
  await sleep(200);
  record({
    at: Date.now(),
    provider: "warehouse",
    op: "insertRows",
    ok: true,
    meta: { table, rows: rows.length },
  });
  const count = rows.length === 1 ? "1 row" : `${rows.length} rows`;
  console.log(`[warehouse] insertRows ${table} ${count}, billed 1 write (call #${call})`);
  return { inserted: rows.length };
}
