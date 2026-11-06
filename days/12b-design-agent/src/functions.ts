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
    // @lesson:start The agent writes the card as code
    const { result, variant, experimentRef } = await group.experiment("design-prompt", {
      variants: {
        classic: () => step.run("design-classic", () => designCard({ prompt, variant: "classic" })),
        bold: () => step.run("design-bold", () => designCard({ prompt, variant: "bold" })),
      },
      select: experiment.weighted({ classic: 50, bold: 50 }),
    });
    // @lesson:stub const variant = "classic";
    // @lesson:end
    // @lesson:start The sandbox runs it, not our servers
    const sandbox = await step.sandbox.create("create-renderer", {
      name: `card-${cardId}`,
      vcpu: 1,
      memoryMb: 1024,
    });
    const first = await sandbox.commands.run("render-card", ["node", "-e", result.code]);
    // @lesson:end
    // @lesson:start If it breaks, the agent reads the error and revises
    let render = first;
    if (first.exitCode !== 0) {
      const error = first.stderr;
      const fix = await step.run("revise-design", () =>
        designCard({ prompt, variant, previousError: error }),
      );
      render = await sandbox.commands.run("render-revision", ["node", "-e", fix.code]);
    }
    // @lesson:stub const render = { stdout: "" };
    // @lesson:end
    // @lesson:start Durable execution keeps score
    await inngest.score.experiment({
      name: "renders-first-try",
      value: first.exitCode === 0,
      experiment: experimentRef,
    });
    defer("score-reaction", {
      function: reactionScorer,
      data: { cardId },
      experiment: experimentRef,
    });
    await sandbox.destroy("destroy-renderer");
    // @lesson:end
    await step.run("deliver", () => sendCard(event.data));
    return { variant, svg: render.stdout };
  },
);

export const functions = [designCardFn, reactionScorer];
