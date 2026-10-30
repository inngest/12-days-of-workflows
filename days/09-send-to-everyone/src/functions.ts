import { sendCard } from "@12days/shared";
import { inngest } from "./client.js";
import { cardBulkSend, deliveryRequested } from "./events.js";

export const sendToEveryone = inngest.createFunction(
  { id: "send-to-everyone", triggers: [cardBulkSend] },
  async ({ event, step }) => {
    // @lesson:start Fan out: one event per recipient
    const { cardId, recipients } = event.data;
    const deliveries = recipients.map((to) => deliveryRequested.create({ cardId, to }));
    await step.sendEvent("fan-out", deliveries);
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
  { id: "deliver-card", triggers: [deliveryRequested] },
  async ({ event, step }) => step.run("deliver", () => sendCard(event.data)),
);
// @lesson:end

// @lesson:start Register the delivery function
export const functions = [sendToEveryone, deliverCard];
// @lesson:stub export const functions = [sendToEveryone];
// @lesson:end
