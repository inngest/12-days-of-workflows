import { sendCard } from "@12days/shared";
import { eventType, staticSchema } from "inngest";
import { inngest } from "./client.js";
import type { ScheduledCard } from "./events.js";

const cardScheduledBefore = eventType("card/scheduled.before", {
  schema: staticSchema<ScheduledCard>(),
});

// No cancelOn: deleting the card does nothing, and the sleeping run delivers it anyway.
export const scheduleDeliveryBefore = inngest.createFunction(
  { id: "schedule-delivery-before", triggers: [cardScheduledBefore] },
  async ({ event, step }) => {
    await step.sleepUntil("wait-for-delivery-date", event.data.deliverAt);
    await step.run("deliver", () => sendCard(event.data));
  },
);

export const beforeFunctions = [scheduleDeliveryBefore];
