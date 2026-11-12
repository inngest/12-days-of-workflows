import { sendCard } from "@12days/shared";
import { eventType, staticSchema } from "inngest";
import { inngest } from "./client.js";
import type { ApprovedCard } from "./events.js";

const cardApprovedBefore = eventType("card/approved.before", {
  schema: staticSchema<ApprovedCard>(),
});

// No cancelOn: deleting the card does nothing, and the sleeping run delivers it anyway.
export const scheduleDeliveryBefore = inngest.createFunction(
  { id: "schedule-delivery-before", triggers: [cardApprovedBefore] },
  async ({ event, step }) => {
    await step.sleepUntil("wait-for-delivery-date", event.data.deliverAt);
    await step.run("deliver", () => sendCard({ to: event.data.to, cardId: event.data.cardId }));
  },
);

export const beforeFunctions = [scheduleDeliveryBefore];
