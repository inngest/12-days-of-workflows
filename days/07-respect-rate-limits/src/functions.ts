import { renderImage, sendCard, writeCard } from "@12days/shared";
import { inngest } from "./client.js";
import { cardRequested, invokedWithText } from "./events.js";

export const renderCardImage = inngest.createFunction(
  {
    id: "render-card-image",
    retries: 10,
    triggers: [invokedWithText],
    // @lesson:start Start at most 4 renders per 10 seconds, just under the provider's 5
    throttle: { limit: 4, period: "10s" },
    // @lesson:end
  },
  async ({ event, step }) => step.run("render", () => renderImage({ text: event.data.text })),
);

export const createCard = inngest.createFunction(
  { id: "create-card", triggers: [cardRequested] },
  async ({ event, step }) => {
    const card = await step.run("write-text", () => writeCard(event.data));
    const image = await step.invoke("render-image", {
      function: renderCardImage,
      data: { text: card.text },
    });
    await step.run("deliver", () => sendCard(event.data));
    return { text: card.text, image: image.url };
  },
);

export const functions = [createCard, renderCardImage];
