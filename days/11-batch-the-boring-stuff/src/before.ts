import { insertRows } from "@12days/shared";
import { inngest } from "./client.js";
import { cardOpenedBefore } from "./events.js";

// No batching: every open is its own run and its own billed warehouse write.
export const recordOpensBefore = inngest.createFunction(
  { id: "record-opens-before", triggers: [cardOpenedBefore] },
  async ({ event, step }) => step.run("insert-open", () => insertRows("card_opens", [event.data])),
);

export const beforeFunctions = [recordOpensBefore];
