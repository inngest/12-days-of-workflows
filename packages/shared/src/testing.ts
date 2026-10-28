import type { Inngest } from "inngest";
import type { LedgerEntry } from "./ledger.js";

export type RunStatus = "Completed" | "Failed" | "Cancelled" | "Running";

export type Scenario = {
  description: string; // shown by `pnpm send NN --list`
  env?: Record<string, string>; // e.g. { DRAFT_TTL: "5s" } for check runs
  send: (ctx: { inngest: Inngest; sleep: (ms: number) => Promise<void> }) => Promise<string[]>; // ids of every event sent
  expect: {
    settleMs: number; // wait this long before asserting
    runs?: { fn: string; status: RunStatus; count?: number }[];
    ledger?: Record<`${string}.${string}`, number>; // exact call counts, e.g. "llm.writeCard": 1
    deliveredOrder?: string[]; // cardIds, from mail ledger entries
    custom?: (ledger: LedgerEntry[]) => string | null; // null = pass
  };
};
