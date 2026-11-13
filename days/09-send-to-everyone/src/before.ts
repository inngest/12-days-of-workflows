import { sendCard } from "@12days/shared";
import { inngest } from "./client.js";
import { cardBulkSendBefore } from "./events.js";

// The loop-inside-a-step anti-pattern: one failure retries the whole step, so everyone
// delivered before it gets the card again.
export const sendToEveryoneBefore = inngest.createFunction(
  { id: "send-to-everyone-before", triggers: [cardBulkSendBefore] },
  async ({ event, step }) => {
    await step.run("deliver-all", async () => {
      for (const to of event.data.recipients) {
        await sendCard({ to, cardId: event.data.cardId });
      }
    });

    return { queued: event.data.recipients.length };
  },
);

export const beforeFunctions = [sendToEveryoneBefore];
