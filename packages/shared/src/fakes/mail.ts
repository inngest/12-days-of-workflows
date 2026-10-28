import { chaosFailure } from "../chaos.js";
import { nextCallNumber, record } from "../ledger.js";
import { sleep } from "./seed.js";

export async function sendCard(input: {
  to: string;
  cardId: string;
}): Promise<{ deliveredAt: string }> {
  const { to, cardId } = input;
  const call = nextCallNumber("mail", cardId);
  await sleep(100);

  const failure = chaosFailure("mail", call);
  if (failure) {
    record({ at: Date.now(), provider: "mail", op: "sendCard", cardId, ok: false, meta: { to } });
    console.log(`[mail] sendCard ${cardId} to ${to} failed ${failure.status} (call #${call})`);
    throw failure;
  }

  const deliveredAt = new Date().toISOString();
  record({ at: Date.now(), provider: "mail", op: "sendCard", cardId, ok: true, meta: { to } });
  console.log(`[mail] sendCard ${cardId} delivered to ${to} (call #${call})`);
  return { deliveredAt };
}

export async function notifySender(cardId: string, reason: string): Promise<void> {
  const call = nextCallNumber("mail", cardId);
  await sleep(100);
  record({
    at: Date.now(),
    provider: "mail",
    op: "notifySender",
    cardId,
    ok: true,
    meta: { reason },
  });
  console.log(`[mail] notifySender ${cardId} "${reason}" (call #${call})`);
}
