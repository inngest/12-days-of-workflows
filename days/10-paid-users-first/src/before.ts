import { renderImage, sendCard, writeCard } from "@12days/shared";
import { inngest } from "./client.js";
import { cardRequestedBefore } from "./events.js";

// No priority: the queue is first come, first served, whatever the customer pays.
export const createCardBefore = inngest.createFunction(
  { id: "create-card-before", triggers: [cardRequestedBefore], concurrency: { limit: 2 } },
  async ({ event, step }) => {
    const card = await step.run("write-text", () => writeCard(event.data));

    const image = await step.run("render-image", () => renderImage({ text: card.text }));

    await step.run("deliver", () => sendCard(event.data));

    return { text: card.text, image: image.url };
  },
);

export const beforeFunctions = [createCardBefore];
