import { renderImage, sendCard, writeCard } from "@12days/shared";
import { inngest } from "./client.js";
import { cardRequested, invokedWithText } from "./events.js";

// TODO: Give rendering its own function and retry policy

export const createCard = inngest.createFunction(
  { id: "create-card", triggers: [cardRequested] },
  async ({ event, step }) => {
    const card = await step.run("write-text", () => writeCard(event.data));

    // TODO: Invoke it and wait for the result
    const image = await step.run("render-image", () => renderImage({ text: card.text }));

    await step.run("deliver", () => sendCard(event.data));

    return { text: card.text, image: image.url };
  },
);

// TODO: Register the rendering function
export const functions = [createCard];
