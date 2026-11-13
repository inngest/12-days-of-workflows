import { drafts, renderImage, sendCard, writeCard } from "@12days/shared";
import { inngest } from "./client.js";
import { cardApproved, cardRequested } from "./events.js";

export const createCard = inngest.createFunction(
  { id: "create-card", triggers: [cardRequested] },
  async ({ event, step }) => {
    const card = await step.run("write-text", () => writeCard(event.data));

    await step.run("render-image", () => renderImage({ text: card.text }));

    await step.run("save-draft", () => drafts.save(event.data.cardId, card.text));

    // TODO: Pause until the sender approves, or give up

    await step.run("deliver", () => sendCard(event.data));

    return { status: "delivered" };
  },
);

export const functions = [createCard];
