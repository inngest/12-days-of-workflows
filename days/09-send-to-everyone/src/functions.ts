import { sendCard } from "@12days/shared";
import { inngest } from "./client.js";
import { cardBulkSend, deliveryRequested } from "./events.js";

export const sendToEveryone = inngest.createFunction(
  { id: "send-to-everyone", triggers: [cardBulkSend] },
  async ({ event, step }) => {
    // TODO: Fan out: one event per recipient
    await step.run("deliver-all", async () => {
      for (const to of event.data.recipients) {
        await sendCard({ to, cardId: event.data.cardId });
      }
    });
    return { queued: event.data.recipients.length };
  },
);

// TODO: Each delivery is its own run with its own retries

// TODO: Register the delivery function
export const functions = [sendToEveryone];
