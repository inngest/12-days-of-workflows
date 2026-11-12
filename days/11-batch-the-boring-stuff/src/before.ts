import { insertRows } from "@12days/shared";
import { eventType, staticSchema } from "inngest";
import { inngest } from "./client.js";
import type { CardOpened } from "./events.js";

const cardOpenedBefore = eventType("card/opened.before", {
  schema: staticSchema<CardOpened>(),
});

// One event, one run, one billed warehouse write.
export const recordOpenBefore = inngest.createFunction(
  { id: "record-open-before", triggers: [cardOpenedBefore] },
  async ({ event, step }) => step.run("insert-open", () => insertRows("card_opens", [event.data])),
);

export const beforeFunctions = [recordOpenBefore];
