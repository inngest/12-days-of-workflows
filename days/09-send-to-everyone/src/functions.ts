import { sendCard } from "@12days/shared";
import { inngest } from "./client.js";
import { cardBulkSend, cardDeliver } from "./events.js";

export const bulkSend = inngest.createFunction(
  { id: "bulk-send", triggers: [cardBulkSend] },
  async ({ event, step }) => {
    // TODO: Fan out: one event per recipient
    await step.run("send-all", async () => { for (const to of event.data.recipients) await sendCard({ to, cardId: event.data.cardId }); });
    return { queued: event.data.recipients.length };
  },
);

// TODO: Each delivery is its own run with its own retries
export const deliverCard = inngest.createFunction({ id: "deliver-card", triggers: [cardDeliver] }, async () => undefined);

export const functions = [bulkSend, deliverCard];
