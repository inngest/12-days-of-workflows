import { insertRows } from "@12days/shared";
import { inngest } from "./client.js";
import { cardOpened } from "./events.js";

export const recordOpens = inngest.createFunction(
  {
    id: "record-opens",
    triggers: [cardOpened],
    // Collect up to 50 opens, or whatever arrives in 5 s
    batchEvents: { maxSize: 50, timeout: "5s" },
  },
  // Handle the whole batch at once
  async ({ events, step }) => {
    const opens = events.map((event) => event.data);

    return step.run("insert-opens", () => insertRows("card_opens", opens));
  },
);

export const functions = [recordOpens];
