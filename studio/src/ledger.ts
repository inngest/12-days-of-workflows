import type { LedgerEntry } from "@12days/shared";

export type LedgerSummary = {
  llmCalls: number;
  imageCalls: number;
  rateLimited: number; // image calls turned away with a 429
  emailsSent: number;
  notified: number; // "your card failed" notes to the sender
  duplicates: number; // repeat LLM bills plus repeat deliveries
  warehouseWrites: number;
  costUsd: number;
  deliveryOrder: string[]; // cardIds, in the order their email went out
  lastDelivery: { cardId: string; to: string; prompt: string } | null;
};

/** How many entries share a key beyond the first one. */
function repeats(keys: string[]): number {
  return keys.length - new Set(keys).size;
}

export async function fetchLedger(port: number): Promise<LedgerEntry[]> {
  const res = await fetch(`http://localhost:${port}/__ledger`, {
    signal: AbortSignal.timeout(700),
  });
  return (await res.json()) as LedgerEntry[];
}

export function summarize(entries: LedgerEntry[]): LedgerSummary {
  const llm = entries.filter((e) => e.provider === "llm");
  const image = entries.filter((e) => e.provider === "image");
  const sent = entries.filter((e) => e.provider === "mail" && e.op === "sendCard" && e.ok);

  const billed = llm.filter((e) => e.ok);
  const billKeys = billed.map((e) =>
    JSON.stringify([e.op, e.cardId, e.meta?.prompt, e.meta?.variant]),
  );
  const mailKeys = sent.map((e) => JSON.stringify([e.cardId, e.meta?.to]));

  // Day 09 sends one card to many people: name each delivery by recipient, not by card.
  const oneCard = sent.length > 1 && new Set(sent.map((e) => e.cardId)).size === 1;
  const deliveryName = (e: LedgerEntry) =>
    oneCard ? String(e.meta?.to).split("@")[0] : (e.cardId ?? "?");

  const last = sent.at(-1);
  const lastPrompt = llm.filter((e) => e.cardId === last?.cardId).at(-1)?.meta?.prompt;

  return {
    llmCalls: llm.length,
    imageCalls: image.length,
    rateLimited: entries.filter((e) => !e.ok && e.meta?.status === 429).length,
    emailsSent: sent.length,
    notified: entries.filter((e) => e.provider === "mail" && e.op === "notifySender").length,
    duplicates: repeats(billKeys) + repeats(mailKeys),
    warehouseWrites: entries.filter((e) => e.provider === "warehouse").length,
    costUsd: entries.reduce((sum, e) => sum + (e.costUsd ?? 0), 0),
    deliveryOrder: sent.map(deliveryName),
    lastDelivery: last
      ? { cardId: last.cardId ?? "?", to: String(last.meta?.to), prompt: String(lastPrompt ?? "") }
      : null,
  };
}
