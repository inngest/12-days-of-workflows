import { renderImage, sendCard, writeCard } from "@12days/shared";
import { inngest } from "./client.js";
import { cardRequested } from "./events.js";

export const createCard = inngest.createFunction(
  { id: "create-card", triggers: [cardRequested] },
  async ({ event, step }) => {
    // TODO: Wrap each provider call in its own step
    const card = await writeCard(event.data);
    const image = await renderImage({ text: card.text });
    await sendCard(event.data);

    return { text: card.text, image: image.url };
  },
);

export const functions = [createCard];
