import { renderImage, sendCard, writeCard } from "@12days/shared";
import { inngest } from "./client.js";
import { cardRequestedBefore } from "./events.js";

// No steps: any failure retries the whole function, including the LLM call.
export const createCardBefore = inngest.createFunction(
  { id: "create-card-before", triggers: [cardRequestedBefore] },
  async ({ event }) => {
    const card = await writeCard(event.data);

    const image = await renderImage({ text: card.text });

    await sendCard(event.data);

    return { text: card.text, image: image.url };
  },
);

export const beforeFunctions = [createCardBefore];
