import { sendCard } from "@12days/shared";
import { inngest } from "./client.js";
import { cardBulkSend, cardDeliver } from "./events.js";

export const bulkSend = inngest.createFunction(
  { id: "bulk-send", triggers: [cardBulkSend] },
  async ({ event, step }) => {
    // @lesson:start Fan out: one event per recipient
    await step.sendEvent(
      "fan-out",
      event.data.recipients.map((to) => cardDeliver.create({ cardId: event.data.cardId, to })),
    );
    // @lesson:stub await step.run("deliver-all", async () => {
    // @lesson:stub   for (const to of event.data.recipients) {
    // @lesson:stub     await sendCard({ to, cardId: event.data.cardId });
    // @lesson:stub   }
    // @lesson:stub });
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
// @lesson:end

// @lesson:start Register the delivery function
export const functions = [bulkSend, deliverCard];
// @lesson:stub export const functions = [bulkSend];
// @lesson:end
