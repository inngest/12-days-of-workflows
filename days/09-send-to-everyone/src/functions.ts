import { sendCard } from "@12days/shared";
import { inngest } from "./client.js";
import { cardBulkSend, deliveryRequested } from "./events.js";

export const sendToEveryone = inngest.createFunction(
  { id: "send-to-everyone", triggers: [cardBulkSend] },
  async ({ event, step }) => {
    // Fan out: one event per recipient
    const { cardId, recipients } = event.data;

    const deliveries = recipients.map((to) => deliveryRequested.create({ cardId, to }));

    await step.sendEvent("fan-out", deliveries);

    return { queued: event.data.recipients.length };
  },
);

// Each delivery is its own run with its own retries
export const deliverCard = inngest.createFunction(
  { id: "deliver-card", triggers: [deliveryRequested] },
  async ({ event, step }) => step.run("deliver", () => sendCard(event.data)),
);

export const functions = [sendToEveryone, deliverCard];
