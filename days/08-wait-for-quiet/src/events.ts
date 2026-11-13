import { eventType, staticSchema } from "inngest";

export type CardEdit = { cardId: string; prompt: string };

export const cardEdited = eventType("card/edited", {
  schema: staticSchema<CardEdit>(),
});

export const cardEditedBefore = eventType("card/edited.before", {
  schema: staticSchema<CardEdit>(),
});
