import { eventType, staticSchema } from "inngest";

export type ApprovedCard = { cardId: string; to: string; deliverAt: string }; // ISO 8601

export const cardApproved = eventType("card/approved", {
  schema: staticSchema<ApprovedCard>(),
});

export const cardDeleted = eventType("card/deleted", {
  schema: staticSchema<{ cardId: string }>(),
});

export const cleanupRequested = eventType("drafts/cleanup.requested", {
  schema: staticSchema<Record<string, never>>(),
});
