import { renderImage, sendCard, writeCard } from "@12days/shared";
import { eventType, staticSchema } from "inngest";
import { inngest } from "./client.js";
import type { CardRequest } from "./events.js";

const cardRequestedBefore = eventType("card/requested.before", {
  schema: staticSchema<CardRequest>(),
});

// No steps: any failure retries the whole function, including the LLM call.
export const createCardBefore = inngest.createFunction(
  { id: "create-card-before", triggers: [cardRequestedBefore] },
  async ({ event }) => {
    const card = await writeCard(event.data);
    const image = await renderImage({ text: card.text });
    await sendCard({ to: event.data.to, cardId: event.data.cardId });
    return { text: card.text, image: image.url };
  },
);

export const beforeFunctions = [createCardBefore];
