import { sendCard } from "@12days/shared";
import { inngest } from "./client.js";
import { cardScheduledBefore } from "./events.js";

// No cancelOn: deleting the card does nothing, and the sleeping run delivers it anyway.
export const scheduleDeliveryBefore = inngest.createFunction(
  { id: "schedule-delivery-before", triggers: [cardScheduledBefore] },
  async ({ event, step }) => {
    await step.sleepUntil("wait-for-delivery-date", event.data.deliverAt);

    await step.run("deliver", () => sendCard(event.data));
  },
);

export const beforeFunctions = [scheduleDeliveryBefore];
