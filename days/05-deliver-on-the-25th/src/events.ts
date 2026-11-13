import { eventType, staticSchema } from "inngest";

export type ScheduledCard = { cardId: string; to: string; deliverAt: string }; // ISO 8601

export const cardScheduled = eventType("card/scheduled", {
  schema: staticSchema<ScheduledCard>(),
});

export const cardScheduledBefore = eventType("card/scheduled.before", {
  schema: staticSchema<ScheduledCard>(),
});

export const cardDeleted = eventType("card/deleted", {
  schema: staticSchema<{ cardId: string }>(),
});

export const cleanupRequested = eventType("drafts/cleanup.requested");
