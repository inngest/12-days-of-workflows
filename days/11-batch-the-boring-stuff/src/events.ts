import { eventType, staticSchema } from "inngest";

export type CardOpen = { cardId: string; openedAt: string };

export const cardOpened = eventType("card/opened", {
  schema: staticSchema<CardOpen>(),
});
