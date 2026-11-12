import { sendCard } from "@12days/shared";
import { inngest } from "./client.js";
import { cardBulkSend, cardDeliver } from "./events.js";

export const bulkSend = inngest.createFunction(
  { id: "bulk-send", triggers: [cardBulkSend] },
  async ({ event, step }) => {
    // @lesson:start Fan out: one event per recipient
    await step.sendEvent(
      "send-deliveries",
      event.data.recipients.map((to) => cardDeliver.create({ cardId: event.data.cardId, to })),
    );
    // @lesson:stub await step.run("send-all", async () => { for (const to of event.data.recipients) await sendCard({ to, cardId: event.data.cardId }); });
    // @lesson:end
    return { queued: event.data.recipients.length };
  },
);

// @lesson:start Each delivery is its own run with its own retries
export const deliverCard = inngest.createFunction(
  { id: "deliver-card", triggers: [cardDeliver] },
  async ({ event, step }) =>
    step.run("deliver", () => sendCard({ to: event.data.to, cardId: event.data.cardId })),
);
// @lesson:stub export const deliverCard = inngest.createFunction({ id: "deliver-card", triggers: [cardDeliver] }, async () => undefined);
// @lesson:end

export const functions = [bulkSend, deliverCard];
