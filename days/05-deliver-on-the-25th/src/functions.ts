import { drafts, sendCard } from "@12days/shared";
import { inngest } from "./client.js";
import { cardApproved, cardDeleted, cleanupRequested } from "./events.js";

export const scheduleDelivery = inngest.createFunction(
  {
    id: "schedule-delivery",
    triggers: [cardApproved],
    // TODO: Cancel the sleeping run when the card is deleted
  },
  async ({ event, step }) => {
    // TODO: Sleep until the delivery date
    await step.run("deliver", () => sendCard({ to: event.data.to, cardId: event.data.cardId }));
  },
);

// TODO: Clean up abandoned drafts nightly, or on demand
export const cleanupDrafts = inngest.createFunction({ id: "cleanup-drafts", triggers: [cleanupRequested] }, async () => {});

export const functions = [scheduleDelivery, cleanupDrafts];
