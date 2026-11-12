import { designCard, sendCard } from "@12days/shared";
import { experiment } from "inngest";
import { createScorer } from "inngest/experimental";
import { z } from "zod";
import { inngest } from "./client.js";
import { cardReacted, cardRequested } from "./events.js";

// The same scorer as Day 12: it waits for the recipient's reaction.
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

export const designCardFn = inngest.createFunction(
  { id: "design-card", triggers: [cardRequested] },
  async ({ event, step, group, defer }) => {
    const { cardId, prompt } = event.data;
    // TODO: The agent writes the card as code
    const variant = "classic";
    // TODO: The sandbox runs it, not our servers
    // TODO: If it breaks, the agent reads the error and revises
    const render = { stdout: "" };
    // TODO: Durable execution keeps score
    await step.run("deliver", () => sendCard(event.data));
    return { variant, svg: render.stdout };
  },
);

export const functions = [designCardFn, reactionScorer];
