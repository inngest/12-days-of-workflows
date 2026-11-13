import { checkPrompt, notifySender, renderImage, sendCard, writeCard } from "@12days/shared";
import { NonRetriableError } from "inngest";
import { inngest } from "./client.js";
import { cardRequested } from "./events.js";

export const createCard = inngest.createFunction(
  {
    id: "create-card",
    triggers: [cardRequested],
    // TODO: Tell the sender when a card fails for good
  },
  async ({ event, step }) => {
    await step.run("moderate", () => {
      const verdict = checkPrompt(event.data.prompt);
      // TODO: Stop retrying when moderation says no
    });
    const card = await step.run("write-text", () => writeCard(event.data));
    const image = await step.run("render-image", () => renderImage({ text: card.text }));
    await step.run("deliver", () => sendCard(event.data));
    return { text: card.text, image: image.url };
  },
);

export const functions = [createCard];
