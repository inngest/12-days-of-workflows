import { eventType, staticSchema } from "inngest";

export type BulkSend = { cardId: string; recipients: string[] };

export const cardBulkSend = eventType("card/bulk-send", {
  schema: staticSchema<BulkSend>(),
});

export const deliveryRequested = eventType("card/delivery.requested", {
  schema: staticSchema<{ cardId: string; to: string }>(),
});
