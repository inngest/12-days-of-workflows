import { writeCardCode } from "@12days/shared";
import { createScorer, getSandboxError } from "inngest/experimental";
import { z } from "zod";
import { inngest } from "./client.js";
import { cardReacted, cardRequested } from "./events.js";

// TODO: A scorer that waits for the recipient's reaction
export const reactionScorer = createScorer(inngest, { id: "score-recipient-reaction", schema: z.object({ cardId: z.string() }) }, async () => null);

export const createCard = inngest.createFunction(
  { id: "create-card", triggers: [cardRequested] },
  async ({ event, step, defer }) => {
    // TODO: The agent writes the card as code
    const card = { code: "" };
    // TODO: Run that code in a sandbox, not on our servers; broken code is a score, not a crash
    const renders = card.code.length > 0;
    return { renders };
  },
);

export const functions = [createCard, reactionScorer];
