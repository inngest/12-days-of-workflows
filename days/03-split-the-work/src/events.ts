import { eventType, invoke, staticSchema } from "inngest";

export type CardRequest = { cardId: string; prompt: string; to: string };

export const cardRequested = eventType("card/requested", {
  schema: staticSchema<CardRequest>(),
});

export const imageRequested = invoke(staticSchema<{ text: string }>());
