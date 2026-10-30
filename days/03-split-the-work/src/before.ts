import { renderImage, sendCard, writeCard } from "@12days/shared";
import { eventType, staticSchema } from "inngest";
import { inngest } from "./client.js";
import type { CardRequest } from "./events.js";

const cardRequestedBefore = eventType("card/requested.before", {
  schema: staticSchema<CardRequest>(),
});

// One function, one retry policy: the flaky image step gets the same 4 retries as everything else.
export const createCardBefore = inngest.createFunction(
  { id: "create-card-before", triggers: [cardRequestedBefore] },
  async ({ event, step }) => {
    const card = await step.run("write-text", () => writeCard(event.data));
    const image = await step.run("render-image", () => renderImage({ text: card.text }));
    await step.run("deliver", () => sendCard(event.data));
    return { text: card.text, image: image.url };
  },
);

export const beforeFunctions = [createCardBefore];
