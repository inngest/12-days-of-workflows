import { drafts, sendCard } from "@12days/shared";
import { inngest } from "./client.js";
import { cardDeleted, cardScheduled, cleanupRequested } from "./events.js";

export const scheduleDelivery = inngest.createFunction(
  {
    id: "schedule-delivery",
    triggers: [cardScheduled],
    // TODO: Cancel the sleeping run when the card is deleted
  },
  async ({ event, step }) => {
    // TODO: Sleep until the delivery date
    await step.run("deliver", () => sendCard(event.data));
  },
);

// TODO: Clean up abandoned drafts nightly, or on demand

// TODO: Register the cleanup function
export const functions = [scheduleDelivery];
