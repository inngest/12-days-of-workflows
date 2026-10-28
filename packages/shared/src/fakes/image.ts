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

let recentCalls: number[] = [];
onReset(() => {
  recentCalls = [];
});

/** Returns ms until a slot frees up, or 0 if this call is allowed (and takes the slot). */
function takeRateSlot(now: number): number {
  const limit = rateLimit();
  if (!limit) return 0;
  recentCalls = recentCalls.filter((at) => now - at < limit.periodMs);
  if (recentCalls.length >= limit.calls) return recentCalls[0] + limit.periodMs - now;
  recentCalls.push(now);
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
    throw failure;
  }

  const url = `https://images.example.com/cards/${seed.toString(16)}.png`;
  record({ at: Date.now(), provider: "image", op: "renderImage", cardId, ok: true, meta: { url } });
  console.log(`${label} rendered (call #${call})`);
  return { url };
}
