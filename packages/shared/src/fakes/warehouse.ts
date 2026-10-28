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
  console.log(
    `[warehouse] insertRows ${table} ${rows.length} rows, billed 1 write (call #${call})`,
  );
  return { inserted: rows.length };
}
