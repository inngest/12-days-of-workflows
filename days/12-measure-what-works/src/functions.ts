import { sendCard, writeCard } from "@12days/shared";
import { experiment } from "inngest";
import { createScorer } from "inngest/experimental";
import { z } from "zod";
import { inngest } from "./client.js";
import { cardReacted, cardRequested } from "./events.js";

// @lesson:start A scorer that waits for the recipient's reaction
// @lesson:stub export const reactionScorer = createScorer(inngest, { id: "score-recipient-reaction", schema: z.object({ cardId: z.string() }) }, async () => null);
export const reactionScorer = createScorer(
  inngest,
  { id: "score-recipient-reaction", schema: z.object({ cardId: z.string() }) },
  async ({ step }) => {
    const reaction = await step.waitForEvent("wait-for-reaction", {
      event: cardReacted,
      match: "data.cardId",
      timeout: process.env.REACTION_TTL ?? "7d",
    });
    if (!reaction) return null;
    return { name: "recipient-loved-it", value: reaction.data.loved };
  },
);
// @lesson:end

export const createCard = inngest.createFunction(
  { id: "create-card", triggers: [cardRequested] },
  async ({ event, step, group, defer }) => {
    // @lesson:start Split traffic between two prompt variants
    const {
      result: card,
      variant,
      experimentRef,
    } = await group.experiment("card-tone", {
      variants: {
        classic: () =>
          step.run("write-classic", () => writeCard({ ...event.data, variant: "classic" })),
        warm: () => step.run("write-warm", () => writeCard({ ...event.data, variant: "warm" })),
      },
      select: experiment.weighted({ classic: 50, warm: 50 }),
    });
    // @lesson:stub const card = await step.run("write-text", () => writeCard(event.data));
    // @lesson:stub const variant = "classic";
    // @lesson:end
    // @lesson:start Score now what you know now; defer what you learn later
    await step.score("score-length", { name: "fits-on-card", value: card.text.length <= 280 });
    defer("score-reaction", {
      function: reactionScorer,
      data: { cardId: event.data.cardId },
      experiment: experimentRef,
    });
    // @lesson:end
    await step.run("deliver", () => sendCard({ to: event.data.to, cardId: event.data.cardId }));
    return { variant };
  },
);

export const functions = [createCard, reactionScorer];
