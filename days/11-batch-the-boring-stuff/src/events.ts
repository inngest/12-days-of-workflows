import { eventType, staticSchema } from "inngest";

export type CardOpened = { cardId: string; openedAt: string };

export const cardOpened = eventType("card/opened", {
  schema: staticSchema<CardOpened>(),
});
