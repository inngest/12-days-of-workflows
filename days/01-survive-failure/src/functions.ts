import { renderImage, sendCard, writeCard } from "@12days/shared";
import { inngest } from "./client.js";
import { cardRequested } from "./events.js";

export const createCard = inngest.createFunction(
  { id: "create-card", triggers: [cardRequested] },
  async ({ event, step }) => {
    // @lesson:start Wrap each provider call in its own step
    const card = await step.run("write-text", () => writeCard(event.data));
    const image = await step.run("render-image", () => renderImage({ text: card.text }));
    await step.run("deliver", () => sendCard({ to: event.data.to, cardId: event.data.cardId }));
    // @lesson:stub const card = await writeCard(event.data);
    // @lesson:stub const image = await renderImage({ text: card.text });
    // @lesson:end
    return { text: card.text, image: image.url };
  },
);

export const functions = [createCard];
