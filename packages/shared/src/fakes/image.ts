import { chaosFailure, currentCardId } from "../chaos.js";
import { ProviderError } from "../errors.js";
import { nextCallNumber, onReset, record } from "../ledger.js";
import { hash, seededRandom, sleep } from "./seed.js";

// IMAGE_RATE is "<calls>/<seconds>s" (default "5/10s") or "off".
function rateLimit(): { calls: number; periodMs: number } | null {
  const raw = process.env.IMAGE_RATE ?? "5/10s";
  if (raw === "off") return null;
  const match = /^(\d+)\/(\d+)s$/.exec(raw);
  if (!match) throw new Error(`IMAGE_RATE must look like "5/10s" or "off", got "${raw}"`);
  return { calls: Number(match[1]), periodMs: Number(match[2]) * 1000 };
}

// A token bucket, like most real providers: `calls` tokens to start, one back every
// periodMs / calls. So "5/10s" allows a burst of 5, then one call every 2 s.
let bucket: { tokens: number; at: number } | null = null;
onReset(() => {
  bucket = null;
});

/** Returns ms until a token is free, or 0 if this call is allowed (and spends a token). */
function takeRateSlot(now: number): number {
  const limit = rateLimit();
  if (!limit) return 0;
  const msPerToken = limit.periodMs / limit.calls;
  const prev = bucket ?? { tokens: limit.calls, at: now };
  const tokens = Math.min(limit.calls, prev.tokens + (now - prev.at) / msPerToken);
  if (tokens < 1) {
    bucket = { tokens, at: now };
    return Math.ceil((1 - tokens) * msPerToken);
  }
  bucket = { tokens: tokens - 1, at: now };
  return 0;
}

export async function renderImage(input: { text: string }): Promise<{ url: string }> {
  const cardId = currentCardId();
  const call = nextCallNumber("image", cardId);
  const label = `[image] renderImage ${cardId ?? "-"}`;

  const msUntilFree = takeRateSlot(Date.now());
  if (msUntilFree > 0) {
    record({
      at: Date.now(),
      provider: "image",
      op: "renderImage",
      cardId,
      ok: false,
      meta: { status: 429 },
    });
    console.log(`${label} rate limited, free in ${msUntilFree} ms (call #${call})`);
    throw new ProviderError(429, msUntilFree);
  }

  const seed = hash(input.text);
  await sleep(1000 + Math.floor(seededRandom(seed)() * 2000));

  const failure = chaosFailure("image", call);
  if (failure) {
    record({
      at: Date.now(),
      provider: "image",
      op: "renderImage",
      cardId,
      ok: false,
      meta: { status: failure.status },
    });
    console.log(`${label} failed ${failure.status} (call #${call})`);
    throw failure.error;
  }

  const url = `https://images.example.com/cards/${seed.toString(16)}.png`;
  record({ at: Date.now(), provider: "image", op: "renderImage", cardId, ok: true, meta: { url } });
  console.log(`${label} rendered (call #${call})`);
  return { url };
}
