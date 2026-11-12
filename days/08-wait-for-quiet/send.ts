import type { LedgerEntry, Scenario } from "@12days/shared";
import type { Inngest } from "inngest";

export const lessonBudget = 5;

const edit = (cardId: string, n: number) => ({
  cardId,
  prompt: `${cardId} draft ${n}`,
});

/** 8 edits per card, 300 ms apart. With several cards, their edits interleave. */
async function sendTyping(
  inngest: Inngest,
  sleep: (ms: number) => Promise<void>,
  name: string,
  cardIds: string[],
): Promise<string[]> {
  const ids: string[] = [];
  for (let n = 1; n <= 8; n++) {
    for (const cardId of cardIds) {
      const sent = await inngest.send({ name, data: edit(cardId, n) });
      ids.push(...sent.ids);
    }
    if (n < 8) await sleep(300);
  }
  return ids;
}

function llmCalls(ledger: LedgerEntry[]): LedgerEntry[] {
  return ledger.filter((e) => e.provider === "llm" && e.op === "writeCard" && e.ok);
}

/** Null if every card's LLM call used its 8th (latest) edit. */
function usedLatestEdit(ledger: LedgerEntry[], cardIds: string[]): string | null {
  const prompts = llmCalls(ledger).map((e) => e.meta?.prompt);
  for (const cardId of cardIds) {
    if (!prompts.includes(`${cardId} draft 8`)) return `${cardId}: expected "${cardId} draft 8"`;
  }
  return null;
}

export const scenarios: Record<string, Scenario> = {
  "typing-burst": {
    description: "8 edits to one card in ~2 s: one LLM call, using the latest text",
    send: ({ inngest, sleep }) => sendTyping(inngest, sleep, "card/edited", ["c1"]),
    expect: {
      settleMs: 30_000,
      runs: [{ fn: "regenerate-preview", status: "Completed", count: 1 }],
      ledger: { "llm.writeCard": 1 },
      custom: (ledger) => usedLatestEdit(ledger, ["c1"]),
    },
  },
  "typing-burst-before": {
    description: "Same burst with no debounce: 8 runs, 8 LLM calls",
    send: ({ inngest, sleep }) => sendTyping(inngest, sleep, "card/edited.before", ["c1"]),
    expect: {
      settleMs: 30_000,
      runs: [{ fn: "regenerate-preview-before", status: "Completed", count: 8 }],
      ledger: { "llm.writeCard": 8 },
    },
  },
  "two-cards": {
    description: "Interleaved bursts for c1 and c2: each card settles on its own",
    send: ({ inngest, sleep }) => sendTyping(inngest, sleep, "card/edited", ["c1", "c2"]),
    expect: {
      settleMs: 30_000,
      runs: [{ fn: "regenerate-preview", status: "Completed", count: 2 }],
      ledger: { "llm.writeCard": 2 },
      custom: (ledger) => usedLatestEdit(ledger, ["c1", "c2"]),
    },
  },
};
