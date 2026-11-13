import { drafts, renderImage, sendCard, writeCard } from "@12days/shared";
import { inngest } from "./client.js";
import { cardRequestedBefore } from "./events.js";

// No approval step: the draft is saved and the card goes out before anyone has seen it.
export const createCardBefore = inngest.createFunction(
  { id: "create-card-before", triggers: [cardRequestedBefore] },
  async ({ event, step }) => {
    const card = await step.run("write-text", () => writeCard(event.data));

    await step.run("render-image", () => renderImage({ text: card.text }));

    await step.run("save-draft", () => drafts.save(event.data.cardId, card.text));

    await step.run("deliver", () => sendCard(event.data));

    return { status: "delivered" };
  },
);

export const beforeFunctions = [createCardBefore];
