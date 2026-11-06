import { currentCardId } from "../chaos.js";
import { nextCallNumber, record } from "../ledger.js";
import { hash, seededRandom, sleep } from "./seed.js";

export type DesignCardInput = { prompt: string; variant: string; previousError?: string };

/** How often the first design is broken. "bold" takes more risks, so it breaks more often. */
const BREAK_RATE: Record<string, number> = { classic: 0.25, bold: 0.5 };

const COST_USD = 0.004;

/**
 * The card-designer agent: writes a small Node program that prints the card as SVG.
 * Deterministic per (card, variant). Some first designs are broken; a revision always works.
 */
export async function designCard(input: DesignCardInput): Promise<{ code: string }> {
  const cardId = currentCardId();
  const call = nextCallNumber("llm", cardId);
  const { prompt, variant, previousError } = input;
  const rng = seededRandom(hash(JSON.stringify([cardId, variant])));
  await sleep(500 + Math.floor(rng() * 200));

  // One roll per card, so a card that breaks for "classic" also breaks for "bold".
  const roll = seededRandom(hash(`design:${cardId}`))();
  const isBroken = !previousError && roll < (BREAK_RATE[variant] ?? BREAK_RATE.classic);
  const background = variant === "bold" ? "#c0392b" : "#fdf6e3";
  const ink = variant === "bold" ? "#ffffff" : "#2c3e50";
  // The typo: "backgrond" is not defined, so node exits with a ReferenceError.
  const fill = isBroken ? "backgrond" : "background";

  const code = `
const text = ${JSON.stringify(prompt)};
const escape = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const background = "${background}";
const ink = "${ink}";
console.log(
  \`<svg xmlns="http://www.w3.org/2000/svg" width="480" height="320">\` +
  \`<rect width="480" height="320" fill="\${${fill}}"/>\` +
  \`<text x="240" y="170" font-size="22" text-anchor="middle" fill="\${ink}">\${escape(text)}</text>\` +
  \`</svg>\`
);
`.trim();

  const meta = { variant, revision: Boolean(previousError) };
  record({
    at: Date.now(),
    provider: "llm",
    op: "designCard",
    cardId,
    ok: true,
    costUsd: COST_USD,
    meta,
  });
  console.log(
    `[llm] designCard ${cardId ?? "-"} ${variant} billed $${COST_USD.toFixed(3)} (call #${call})`,
  );
  return { code };
}
