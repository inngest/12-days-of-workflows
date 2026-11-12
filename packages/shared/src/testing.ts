import type { Inngest } from "inngest";
import type { LedgerEntry } from "./ledger.js";

export type RunStatus = "Completed" | "Failed" | "Cancelled" | "Running";

export type Scenario = {
  description: string; // shown by `pnpm send NN --list`
  env?: Record<string, string>; // e.g. { DRAFT_TTL: "5s" } for check runs
  requiresEnv?: string; // `pnpm check` skips this scenario unless the env var is set (Cloud-only features)
  send: (ctx: { inngest: Inngest; sleep: (ms: number) => Promise<void> }) => Promise<string[]>; // ids of every event sent
  expect: {
    settleMs: number; // deadline; runs expecting only finished statuses pass as soon as all hold
    runs?: { fn: string; status: RunStatus; count?: number; output?: unknown }[]; // output: JSON-equal to every matching run
    ledger?: Record<`${string}.${string}`, number>; // exact call counts, e.g. "llm.writeCard": 1
    deliveredOrder?: string[]; // cardIds, from mail ledger entries
    custom?: (ledger: LedgerEntry[]) => string | null; // null = pass
  };
};
