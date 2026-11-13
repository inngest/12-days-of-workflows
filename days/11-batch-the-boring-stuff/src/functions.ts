import { insertRows } from "@12days/shared";
import { inngest } from "./client.js";
import { cardOpened } from "./events.js";

export const recordOpens = inngest.createFunction(
  {
    id: "record-opens",
    triggers: [cardOpened],
    // @lesson:start Collect up to 50 opens, or whatever arrives in 5 s
    batchEvents: { maxSize: 50, timeout: "5s" },
    // @lesson:end
  },
  // @lesson:start Handle the whole batch at once
  async ({ events, step }) => {
    const opens = events.map((event) => event.data);

    return step.run("insert-opens", () => insertRows("card_opens", opens));
  },
  // @lesson:stub async ({ event, step }) => {
  // @lesson:stub   return step.run("insert-open", () => insertRows("card_opens", [event.data]));
  // @lesson:stub },
  // @lesson:end
);

export const functions = [recordOpens];
