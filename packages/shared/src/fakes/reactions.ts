import { hash, seededRandom } from "./seed.js";

const LOVE_RATE: Record<string, number> = { warm: 0.7, classic: 0.4 };

export function simulateReaction(cardId: string, variant: string): boolean {
  const loved = seededRandom(hash(`${cardId}:${variant}`))() < (LOVE_RATE[variant] ?? 0.5);
  console.log(`[reactions] simulateReaction ${cardId} ${variant} ${loved ? "loved" : "meh"}`);
  return loved;
}
