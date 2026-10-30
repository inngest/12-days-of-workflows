import { renderImage, sendCard, writeCard } from "@12days/shared";
import { inngest } from "./client.js";
import { cardRequested, imageRequested } from "./events.js";

// @lesson:start Give rendering its own function and retry policy
export const renderCardImage = inngest.createFunction(
  { id: "render-card-image", retries: 10, triggers: [imageRequested] },
  async ({ event, step }) => step.run("render", () => renderImage({ text: event.data.text })),
);
// @lesson:end

export const createCard = inngest.createFunction(
  { id: "create-card", triggers: [cardRequested] },
  async ({ event, step }) => {
    const card = await step.run("write-text", () => writeCard(event.data));
    // @lesson:start Invoke it and wait for the result
    const image = await step.invoke("render-image", {
      function: renderCardImage,
      data: { text: card.text },
    });
    // @lesson:stub const image = await step.run("render-image", () => renderImage({ text: card.text }));
    // @lesson:end
    await step.run("deliver", () => sendCard({ to: event.data.to, cardId: event.data.cardId }));
    return { text: card.text, image: image.url };
  },
);

// @lesson:start Register the rendering function
export const functions = [createCard, renderCardImage];
// @lesson:stub export const functions = [createCard];
// @lesson:end
