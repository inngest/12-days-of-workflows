import {
  checkPrompt,
  notifySender,
  ProviderError,
  renderImage,
  sendCard,
  writeCard,
} from "@12days/shared";
import { NonRetriableError, RetryAfterError } from "inngest";
import { inngest } from "./client.js";
import { cardRequested } from "./events.js";

export const createCard = inngest.createFunction(
  {
    id: "create-card",
    triggers: [cardRequested],
    // @lesson:start Tell the sender when a card fails for good
    onFailure: async ({ event, error, step }) => {
      await step.run("notify-sender", () =>
        notifySender(event.data.event.data.cardId, error.message),
      );
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
    const card = await step.run("write-text", async () => {
      try {
        return await writeCard(event.data);
      } catch (err) {
        // @lesson:start Retry exactly when the provider says to
        if (err instanceof ProviderError && err.status === 429) {
          throw new RetryAfterError("LLM rate limited", err.retryAfterMs ?? "1m", { cause: err });
        }
        // @lesson:end
        throw err;
      }
    });
    const image = await step.run("render-image", () => renderImage({ text: card.text }));
    await step.run("deliver", () => sendCard({ to: event.data.to, cardId: event.data.cardId }));
    return { text: card.text, image: image.url };
  },
);

export const functions = [createCard];
