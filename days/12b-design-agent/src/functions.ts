import { writeCardCode } from "@12days/shared";
import { createScorer, getSandboxError } from "inngest/experimental";
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
  async ({ event, step, defer }) => {
    // @lesson:start The agent writes the card as code
    // @lesson:stub const card = { code: "" };
    const card = await step.run("write-card-code", () =>
      writeCardCode({ ...event.data, variant: "warm" }),
    );
    // @lesson:end
    // @lesson:start Run that code in a sandbox, not on our servers; broken code is a score, not a crash
    // @lesson:stub const renders = card.code.length > 0;
    let renders = true;
    try {
      await step.sandbox.typescript("render-card", card.code, {
        input: { message: event.data.prompt },
        schema: { output: z.object({ svg: z.string() }) },
        timeout: "20s",
      });
    } catch (error) {
      if (getSandboxError(error)) throw error; // the sandbox itself failed: not the card's fault
      renders = false;
    }
    await step.score("score-renders", { name: "card-renders", value: renders });
    defer("score-reaction", {
      function: reactionScorer,
      data: { cardId: event.data.cardId },
    });
    // @lesson:end
    return { renders };
  },
);

export const functions = [createCard, reactionScorer];
