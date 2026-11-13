import { sendCard, writeCard } from "@12days/shared";
import { experiment } from "inngest";
import { createScorer } from "inngest/experimental";
import { z } from "zod";
import { inngest } from "./client.js";
import { cardReacted, cardRequested } from "./events.js";

// A scorer that waits for the recipient's reaction
export const reactionScorer = createScorer(
  inngest,
  { id: "score-recipient-reaction", schema: z.object({ cardId: z.string() }) },
  async ({ step }) => {
    const reaction = await step.waitForEvent("wait-for-reaction", {
      event: cardReacted,
      timeout: process.env.REACTION_TTL ?? "7d",
      match: "data.cardId",
    });
    if (reaction === null) return null;

    return { name: "recipient-loved-it", value: reaction.data.loved };
  },
);

export const createCard = inngest.createFunction(
  { id: "create-card", triggers: [cardRequested] },
  async ({ event, step, group, defer }) => {
    // Split traffic between two prompt variants
    const { prompt } = event.data;

    const { result, variant, experimentRef } = await group.experiment("card-tone", {
      variants: {
        classic: () => step.run("write-classic", () => writeCard({ prompt, variant: "classic" })),
        warm: () => step.run("write-warm", () => writeCard({ prompt, variant: "warm" })),
      },
      select: experiment.weighted({ classic: 50, warm: 50 }),
    });

    // Score now what you know now; defer what you learn later
    await step.score("score-length", { name: "fits-on-card", value: result.text.length <= 280 });

    defer("score-reaction", {
      function: reactionScorer,
      data: { cardId: event.data.cardId },
      experiment: experimentRef,
    });

    await step.run("deliver", () => sendCard(event.data));

    return { variant };
  },
);

export const functions = [createCard, reactionScorer];
