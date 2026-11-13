import { renderImage, sendCard, writeCard } from "@12days/shared";
import { inngest } from "./client.js";
import { cardRequested } from "./events.js";

export const createCard = inngest.createFunction(
  {
    id: "create-card",
    triggers: [cardRequested],
    concurrency: [
      { limit: 5 }, // total capacity
      // Give each account its own lane
      { key: "event.data.accountId", limit: 2 },
    ],
  },
  async ({ event, step }) => {
    const card = await step.run("write-text", () => writeCard(event.data));

    const image = await step.run("render-image", () => renderImage({ text: card.text }));

    await step.run("deliver", () => sendCard(event.data));

    return { text: card.text, image: image.url };
  },
);

export const functions = [createCard];
