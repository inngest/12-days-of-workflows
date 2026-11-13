import { checkPrompt, notifySender, renderImage, sendCard, writeCard } from "@12days/shared";
import { NonRetriableError } from "inngest";
import { inngest } from "./client.js";
import { cardRequested } from "./events.js";

export const createCard = inngest.createFunction(
  {
    id: "create-card",
    triggers: [cardRequested],
    // @lesson:start Tell the sender when a card fails for good
    onFailure: async ({ event, error, step }) => {
      const card = event.data.event.data;

      await step.run("notify-sender", () => notifySender(card.cardId, error.message));
    },
    // @lesson:end
  },
  async ({ event, step }) => {
    await step.run("moderate", () => {
      const verdict = checkPrompt(event.data.prompt);
      // @lesson:start Stop retrying when moderation says no
      if (!verdict.ok) throw new NonRetriableError(`Rejected: ${verdict.reason}`);
      // @lesson:end
    });

    const card = await step.run("write-text", () => writeCard(event.data));

    const image = await step.run("render-image", () => renderImage({ text: card.text }));

    await step.run("deliver", () => sendCard(event.data));

    return { text: card.text, image: image.url };
  },
);

export const functions = [createCard];
