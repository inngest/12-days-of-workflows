import { eventType, staticSchema } from "inngest";

export type CardBulkSend = { cardId: string; recipients: string[] };
export type CardDeliver = { cardId: string; to: string };

export const cardBulkSend = eventType("card/bulk-send", {
  schema: staticSchema<CardBulkSend>(),
});

export const cardDeliver = eventType("card/deliver", {
  schema: staticSchema<CardDeliver>(),
});
