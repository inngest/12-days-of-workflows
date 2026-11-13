import { checkPrompt, renderImage, sendCard, writeCard } from "@12days/shared";
import { inngest } from "./client.js";
import { cardRequestedBefore } from "./events.js";

// A plain Error looks temporary to Inngest, so a rejected prompt retries until it gives up.
export const createCardBefore = inngest.createFunction(
  { id: "create-card-before", triggers: [cardRequestedBefore] },
  async ({ event, step }) => {
    await step.run("moderate", () => {
      const verdict = checkPrompt(event.data.prompt);
      if (!verdict.ok) throw new Error(`Rejected: ${verdict.reason}`);
    });

    const card = await step.run("write-text", () => writeCard(event.data));

    const image = await step.run("render-image", () => renderImage({ text: card.text }));

    await step.run("deliver", () => sendCard(event.data));

    return { text: card.text, image: image.url };
  },
);

export const beforeFunctions = [createCardBefore];
