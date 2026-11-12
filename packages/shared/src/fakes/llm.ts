import { chaosFailure, currentCardId } from "../chaos.js";
import { nextCallNumber, record } from "../ledger.js";
import { hash, seededRandom, sleep } from "./seed.js";

export type WriteCardInput = { prompt: string; cardId?: string; tone?: string; variant?: string };
export type CardText = { text: string; tokens: number; costUsd: number };

const openers: Record<string, string[]> = {
  classic: ["Season's greetings!", "Happy holidays!", "Warmest wishes this season."],
  warm: [
    "Thinking of you this winter!",
    "Sending you a big holiday hug!",
    "You make the season bright!",
  ],
};

const closers = [
  "May your days be merry and bright.",
  "Here's to a peaceful new year.",
  "Wishing you joy, rest and good cocoa.",
  "See you in the new year!",
];

const USD_PER_TOKEN = 0.0001;

export async function writeCard(input: WriteCardInput): Promise<CardText> {
  const cardId = input.cardId ?? currentCardId();
  const call = nextCallNumber("llm", cardId);
  const variant = input.variant ?? "classic";
  const rng = seededRandom(hash(JSON.stringify([input.prompt, input.tone, variant])));
  await sleep(700 + Math.floor(rng() * 200));

  const meta = { prompt: input.prompt, variant: input.variant };
  const failure = chaosFailure("llm", call);
  if (failure) {
    record({ at: Date.now(), provider: "llm", op: "writeCard", cardId, ok: false, meta });
    console.log(`[llm] writeCard ${cardId ?? "-"} failed ${failure.status} (call #${call})`);
    throw failure.error;
  }

  const pick = (list: string[]) => list[Math.floor(rng() * list.length)];
  const text = `${pick(openers[variant] ?? openers.classic)} ${input.prompt}. ${pick(closers)}`;
  const tokens = Math.ceil(text.length / 4);
  const costUsd = Math.round(tokens * USD_PER_TOKEN * 1000) / 1000;
  record({ at: Date.now(), provider: "llm", op: "writeCard", cardId, ok: true, costUsd, meta });
  console.log(`[llm] writeCard ${cardId ?? "-"} billed $${costUsd.toFixed(3)} (call #${call})`);
  return { text, tokens, costUsd };
}

export type WriteCardCodeInput = { prompt: string; variant: string; cardId: string };
export type CardCode = { code: string; tokens: number; costUsd: number };

const palettes: Record<string, { bg: string; fg: string }> = {
  classic: { bg: "#1f4d36", fg: "#f4e9c9" },
  warm: { bg: "#b5382a", fg: "#fff3e0" },
};

/**
 * Pretends an agent wrote the card as code. The snippet reads a global `message` (pass it as the
 * sandbox `input`) and ends with `return { svg }`. About 1 card in 4 comes back broken.
 */
export async function writeCardCode(input: WriteCardCodeInput): Promise<CardCode> {
  const { cardId, variant } = input;
  const call = nextCallNumber("llm", cardId);
  const rng = seededRandom(hash(JSON.stringify([input.prompt, variant])));
  await sleep(700 + Math.floor(rng() * 200));

  const meta = { prompt: input.prompt, variant };
  const failure = chaosFailure("llm", call);
  if (failure) {
    record({ at: Date.now(), provider: "llm", op: "writeCardCode", cardId, ok: false, meta });
    console.log(`[llm] writeCardCode ${cardId} failed ${failure.status} (call #${call})`);
    throw failure.error;
  }

  const { bg, fg } = palettes[variant] ?? palettes.classic;
  const svg = [
    `'<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200">'`,
    `'<rect width="320" height="200" fill="${bg}"/>'`,
    `'<text x="160" y="110" fill="${fg}" font-size="20" text-anchor="middle">' + message + '</text>'`,
    `'</svg>'`,
  ].join(" + ");
  // Seeded by cardId alone, so a card is broken (or not) the same way on every retry and variant.
  const brokenRng = seededRandom(hash(`broken:${cardId}`));
  const broken = brokenRng() < 0.25;
  const bug =
    brokenRng() < 0.5 ? "throw new Error('card.draw is not a function');" : "const svg = ;";
  const code = `${broken ? `${bug}\n` : ""}return { svg: ${svg} };`;
  const tokens = Math.ceil(code.length / 4);
  const costUsd = Math.round(tokens * USD_PER_TOKEN * 1000) / 1000;
  record({
    at: Date.now(),
    provider: "llm",
    op: "writeCardCode",
    cardId,
    ok: true,
    costUsd,
    meta: { ...meta, broken },
  });
  console.log(`[llm] writeCardCode ${cardId} billed $${costUsd.toFixed(3)} (call #${call})`);
  return { code, tokens, costUsd };
}
