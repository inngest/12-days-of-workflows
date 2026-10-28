import { currentCardId } from "../chaos.js";

export function checkPrompt(prompt: string): { ok: true } | { ok: false; reason: string } {
  const cardId = currentCardId() ?? "-";
  if (prompt.toLowerCase().includes("grinch")) {
    console.log(`[moderation] checkPrompt ${cardId} rejected`);
    return { ok: false, reason: "prompt mentions the Grinch" };
  }
  console.log(`[moderation] checkPrompt ${cardId} ok`);
  return { ok: true };
}
