import { insertRows } from "@12days/shared";
import { eventType, staticSchema } from "inngest";
import { inngest } from "./client.js";
import type { CardOpen } from "./events.js";

const cardOpenedBefore = eventType("card/opened.before", {
  schema: staticSchema<CardOpen>(),
});

// No batching: every open is its own run and its own billed warehouse write.
export const recordOpensBefore = inngest.createFunction(
  { id: "record-opens-before", triggers: [cardOpenedBefore] },
  async ({ event, step }) => step.run("insert-open", () => insertRows("card_opens", [event.data])),
);

export const beforeFunctions = [recordOpensBefore];
