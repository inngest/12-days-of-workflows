import { renderImage, sendCard, writeCard } from "@12days/shared";
import { inngest } from "./client.js";
import { cardRequested, imageRequested } from "./events.js";

export const renderCardImage = inngest.createFunction(
  {
    id: "render-card-image",
    triggers: [imageRequested],
    retries: 10,
    // TODO: Start at most 3 renders per 3 seconds
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
    await step.run("deliver", () => sendCard({ to: event.data.to, cardId: event.data.cardId }));
    return { text: card.text, image: image.url };
  },
);

export const functions = [createCard, renderCardImage];
