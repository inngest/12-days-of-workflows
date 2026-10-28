import { onReset } from "../ledger.js";

type Draft = { text: string; savedAt: number; expired: boolean };

const store = new Map<string, Draft>();
onReset(() => store.clear());

const UNIT_MS: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };

function parseAge(age: string): number {
  const match = /^(\d+)([smhd])$/.exec(age);
  if (!match) throw new Error(`Age must look like "7d", got "${age}"`);
  return Number(match[1]) * UNIT_MS[match[2]];
}

export const drafts = {
  save(cardId: string, text: string): void {
    store.set(cardId, { text, savedAt: Date.now(), expired: false });
    console.log(`[drafts] save ${cardId}`);
  },
  expire(cardId: string): void {
    const draft = store.get(cardId);
    if (draft) draft.expired = true;
    console.log(`[drafts] expire ${cardId}`);
  },
  deleteOlderThan(age: string): number {
    const cutoff = Date.now() - parseAge(age);
    let deleted = 0;
    for (const [cardId, draft] of store) {
      if (draft.savedAt < cutoff) {
        store.delete(cardId);
        deleted++;
      }
    }
    console.log(`[drafts] deleteOlderThan ${age} deleted ${deleted}`);
    return deleted;
  },
};
