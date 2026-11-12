import { sendCard, writeCard } from "@12days/shared";
import { experiment } from "inngest";
import { createScorer } from "inngest/experimental";
import { z } from "zod";
import { inngest } from "./client.js";
import { cardReacted, cardRequested } from "./events.js";

// TODO: A scorer that waits for the recipient's reaction
export const reactionScorer = createScorer(inngest, { id: "score-recipient-reaction", schema: z.object({ cardId: z.string() }) }, async () => null);

export const createCard = inngest.createFunction(
  { id: "create-card", triggers: [cardRequested] },
  async ({ event, step, group, defer }) => {
    // TODO: Split traffic between two prompt variants
    const card = await step.run("write-text", () => writeCard(event.data));
    const variant = "classic";
    // TODO: Score now what you know now; defer what you learn later
    await step.run("deliver", () => sendCard({ to: event.data.to, cardId: event.data.cardId }));
    return { variant };
  },
);

export const functions = [createCard, reactionScorer];
