import { sendCard, writeCard } from "@12days/shared";
import { experiment } from "inngest";
import { createScorer } from "inngest/experimental";
import { z } from "zod";
import { inngest } from "./client.js";
import { cardReacted, cardRequested } from "./events.js";

// TODO: A scorer that waits for the recipient's reaction

export const createCard = inngest.createFunction(
  { id: "create-card", triggers: [cardRequested] },
  async ({ event, step, group, defer }) => {
    // TODO: Split traffic between two prompt variants
    const result = await step.run("write-text", () => writeCard(event.data));
    const variant = "classic";

    // TODO: Score now what you know now; defer what you learn later

    await step.run("deliver", () => sendCard(event.data));

    return { variant };
  },
);

// TODO: Register the scorer
export const functions = [createCard];
