import { insertRows } from "@12days/shared";
import { inngest } from "./client.js";
import { cardOpened } from "./events.js";

export const recordOpens = inngest.createFunction(
  {
    id: "record-opens",
    triggers: [cardOpened],
    // TODO: Collect up to 50 opens, or whatever arrives in 5 s
  },
  // TODO: Handle the whole batch at once
  async ({ event, step }) => step.run("insert-open", () => insertRows("card_opens", [event.data])),
);

export const functions = [recordOpens];
