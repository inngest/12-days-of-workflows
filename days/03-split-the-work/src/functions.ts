import { renderImage, sendCard, writeCard } from "@12days/shared";
import { inngest } from "./client.js";
import { cardRequested, imageRequested } from "./events.js";

// TODO: Give rendering its own function and retry policy
export const renderCardImage = inngest.createFunction({ id: "render-card-image", triggers: [imageRequested] }, async () => ({ url: "" }));

export const createCard = inngest.createFunction(
  { id: "create-card", triggers: [cardRequested] },
  async ({ event, step }) => {
    const card = await step.run("write-text", () => writeCard(event.data));
    // TODO: Invoke it and wait for the result
    const image = await step.run("render-image", () => renderImage({ text: card.text }));
    await step.run("deliver", () => sendCard({ to: event.data.to, cardId: event.data.cardId }));
    return { text: card.text, image: image.url };
  },
);

export const functions = [createCard, renderCardImage];
