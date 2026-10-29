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
