import type { LedgerEntry, Scenario } from "@12days/shared";
import type { Inngest } from "inngest";

export const lessonBudget = 5;

const MESSAGE = "Merry Christmas from all of us";
const GAP_MS = 300;

/** The prompt after each of 8 edits, growing toward the full message; the last is complete. */
const drafts = Array.from({ length: 8 }, (_, i) =>
  MESSAGE.slice(0, Math.ceil((MESSAGE.length * (i + 1)) / 8)),
);

/** Sends one edit event per draft, GAP_MS apart, alternating cards when given several. */
async function typeDrafts(
  inngest: Inngest,
  sleep: (ms: number) => Promise<void>,
  name: string,
  cardIds: string[],
): Promise<string[]> {
  const ids: string[] = [];
  for (const prompt of drafts) {
    for (const cardId of cardIds) {
      const sent = await inngest.send({ name, data: { cardId, prompt } });
      ids.push(...sent.ids);
      await sleep(GAP_MS);
    }
  }
  return ids;
}

const llmCalls = (ledger: LedgerEntry[]) =>
  ledger.filter((e) => e.provider === "llm" && e.op === "writeCard");

/** null if every card's only LLM call used that card's final draft. */
function usedLatestPrompt(ledger: LedgerEntry[], cardIds: string[]): string | null {
  for (const cardId of cardIds) {
    const prompts = llmCalls(ledger)
      .filter((e) => e.cardId === cardId)
      .map((e) => e.meta?.prompt);
    if (prompts.length !== 1 || prompts[0] !== MESSAGE) {
      return `${cardId}: expected one call with "${MESSAGE}", saw ${JSON.stringify(prompts)}`;
    }
  }
  return null;
}

export const scenarios: Record<string, Scenario> = {
  "typing-burst": {
    description: "8 edits to c1, 300 ms apart: one preview, from the last edit",
    send: ({ inngest, sleep }) => typeDrafts(inngest, sleep, "card/edited", ["c1"]),
    expect: {
      settleMs: 20_000,
      runs: [{ fn: "regenerate-preview", status: "Completed", count: 1 }],
      ledger: { "llm.writeCard": 1 },
      custom: (ledger) => usedLatestPrompt(ledger, ["c1"]),
    },
  },
  "typing-burst-before": {
    description: "Same edits with no debounce: 8 runs, 8 LLM bills",
    send: ({ inngest, sleep }) => typeDrafts(inngest, sleep, "card/edited.before", ["c1"]),
    expect: {
      settleMs: 20_000,
      runs: [{ fn: "regenerate-preview-before", status: "Completed", count: 8 }],
      ledger: { "llm.writeCard": 8 },
    },
  },
  "two-cards": {
    description: "Interleaved edits to c1 and c2: one preview per card",
    send: ({ inngest, sleep }) => typeDrafts(inngest, sleep, "card/edited", ["c1", "c2"]),
    expect: {
      settleMs: 25_000,
      runs: [{ fn: "regenerate-preview", status: "Completed", count: 2 }],
      ledger: { "llm.writeCard": 2 },
      custom: (ledger) => usedLatestPrompt(ledger, ["c1", "c2"]),
    },
  },
};
