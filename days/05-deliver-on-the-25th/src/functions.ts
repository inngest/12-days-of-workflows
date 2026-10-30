import { drafts, sendCard } from "@12days/shared";
import { inngest } from "./client.js";
import { cardApproved, cardDeleted, cleanupRequested } from "./events.js";

export const scheduleDelivery = inngest.createFunction(
  {
    id: "schedule-delivery",
    triggers: [cardApproved],
    // @lesson:start Cancel the sleeping run when the card is deleted
    cancelOn: [{ event: cardDeleted, match: "data.cardId" }],
    // @lesson:end
  },
  async ({ event, step }) => {
    // @lesson:start Sleep until the delivery date
    await step.sleepUntil("wait-for-delivery-date", event.data.deliverAt);
    // @lesson:end
    await step.run("deliver", () => sendCard({ to: event.data.to, cardId: event.data.cardId }));
  },
);

// @lesson:start Clean up abandoned drafts nightly, or on demand
export const cleanupDrafts = inngest.createFunction(
  {
    id: "cleanup-drafts",
    triggers: [{ cron: "TZ=America/New_York 0 3 * * *" }, cleanupRequested],
  },
  async ({ step }) => step.run("delete-stale", () => drafts.deleteOlderThan("7d")),
);
// @lesson:end

// @lesson:start Register the cleanup function
export const functions = [scheduleDelivery, cleanupDrafts];
// @lesson:stub export const functions = [scheduleDelivery];
// @lesson:end
