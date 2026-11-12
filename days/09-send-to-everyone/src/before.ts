import { sendCard } from "@12days/shared";
import { eventType, staticSchema } from "inngest";
import { inngest } from "./client.js";
import type { CardBulkSend } from "./events.js";

const cardBulkSendBefore = eventType("card/bulk-send.before", {
  schema: staticSchema<CardBulkSend>(),
});

// The loop-in-one-step anti-pattern: a failure at recipient 25 retries the whole step,
// so recipients 1-24 get the card again.
export const bulkSendBefore = inngest.createFunction(
  { id: "bulk-send-before", triggers: [cardBulkSendBefore] },
  async ({ event, step }) => {
    await step.run("send-all", async () => {
      for (const to of event.data.recipients) {
        await sendCard({ to, cardId: event.data.cardId });
      }
    });
    return { sent: event.data.recipients.length };
  },
);

export const beforeFunctions = [bulkSendBefore];
