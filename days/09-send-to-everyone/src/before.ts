import { sendCard } from "@12days/shared";
import { eventType, staticSchema } from "inngest";
import { inngest } from "./client.js";
import type { BulkSend } from "./events.js";

const cardBulkSendBefore = eventType("card/bulk-send.before", {
  schema: staticSchema<BulkSend>(),
});

// The loop-inside-a-step anti-pattern: one failure retries the whole step, so everyone
// delivered before it gets the card again.
export const bulkSendBefore = inngest.createFunction(
  { id: "bulk-send-before", triggers: [cardBulkSendBefore] },
  async ({ event, step }) => {
    await step.run("deliver-all", async () => {
      for (const to of event.data.recipients) {
        await sendCard({ to, cardId: event.data.cardId });
      }
    });
    return { queued: event.data.recipients.length };
  },
);

export const beforeFunctions = [bulkSendBefore];
