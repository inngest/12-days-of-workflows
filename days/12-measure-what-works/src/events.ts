import { eventType, staticSchema } from "inngest";

export type CardRequest = { cardId: string; prompt: string; to: string };

export const cardRequested = eventType("card/requested", {
  schema: staticSchema<CardRequest>(),
});

export const cardReacted = eventType("card/reacted", {
  schema: staticSchema<{ cardId: string; loved: boolean }>(),
});
