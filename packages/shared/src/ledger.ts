import { currentFnId } from "./chaos.js";
export type Provider = "llm" | "image" | "mail" | "warehouse";

export type LedgerEntry = {
  at: number;
  provider: Provider;
  op: string;
  cardId?: string;
  ok: boolean;
  costUsd?: number;
  meta?: Record<string, unknown>;
  fn?: string; // id of the function that made the call; the wall splits Broken from Fixed on "-before"
};

const log: LedgerEntry[] = [];
const callCounts = new Map<string, number>();
const resetHooks: (() => void)[] = [];

export function record(entry: LedgerEntry): void {
  log.push({ ...entry, fn: currentFnId() });
}

export function entries(): LedgerEntry[] {
  return [...log];
}

/** Clears the ledger, every call counter (and so every chaos counter), and fake state. */
export function reset(): void {
  log.length = 0;
  callCounts.clear();
  for (const hook of resetHooks) hook();
}

/** Internal: 1-based call number per `${cardId}:${provider}`, cleared by reset(). */
export function nextCallNumber(provider: Provider, cardId = "-"): number {
  const key = `${cardId}:${provider}`;
  const n = (callCounts.get(key) ?? 0) + 1;
  callCounts.set(key, n);
  return n;
}

/** Internal: lets a fake clear its own state when the ledger resets. */
export function onReset(hook: () => void): void {
  resetHooks.push(hook);
}
