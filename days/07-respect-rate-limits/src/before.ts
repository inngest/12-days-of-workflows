import { renderImage, sendCard, writeCard } from "@12days/shared";
import { eventType, staticSchema } from "inngest";
import { inngest } from "./client.js";
import { type CardRequest, invokedWithText } from "./events.js";

const cardRequestedBefore = eventType("card/requested.before", {
  schema: staticSchema<CardRequest>(),
});

// No throttle: every render starts at once, and everything past the provider's limit gets a 429.
export const renderCardImageBefore = inngest.createFunction(
  { id: "render-card-image-before", retries: 10, triggers: [invokedWithText] },
  async ({ event, step }) => step.run("render", () => renderImage({ text: event.data.text })),
);

export const createCardBefore = inngest.createFunction(
  { id: "create-card-before", triggers: [cardRequestedBefore] },
  async ({ event, step }) => {
    const card = await step.run("write-text", () => writeCard(event.data));
    const image = await step.invoke("render-image", {
      function: renderCardImageBefore,
      data: { text: card.text },
    });
    await step.run("deliver", () => sendCard(event.data));
    return { text: card.text, image: image.url };
  },
);

export const beforeFunctions = [createCardBefore, renderCardImageBefore];
