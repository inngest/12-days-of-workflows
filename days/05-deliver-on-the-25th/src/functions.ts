import { drafts, sendCard } from "@12days/shared";
import { inngest } from "./client.js";
import { cardDeleted, cardScheduled, cleanupRequested } from "./events.js";

export const scheduleDelivery = inngest.createFunction(
  {
    id: "schedule-delivery",
    triggers: [cardScheduled],
    // Cancel the sleeping run when the card is deleted
    cancelOn: [{ event: cardDeleted, match: "data.cardId" }],
  },
  async ({ event, step }) => {
    // Sleep until the delivery date
    await step.sleepUntil("wait-for-delivery-date", event.data.deliverAt);

    await step.run("deliver", () => sendCard(event.data));
  },
);

// Clean up abandoned drafts nightly, or on demand
export const cleanupDrafts = inngest.createFunction(
  {
    id: "cleanup-drafts",
    triggers: [{ cron: "TZ=America/New_York 0 3 * * *" }, cleanupRequested],
  },
  async ({ step }) => step.run("delete-stale", () => drafts.deleteOlderThan("7d")),
);

export const functions = [scheduleDelivery, cleanupDrafts];
