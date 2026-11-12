import { writeCard } from "@12days/shared";
import { inngest } from "./client.js";
import { cardEdited } from "./events.js";

export const regeneratePreview = inngest.createFunction(
  {
    id: "regenerate-preview",
    triggers: [cardEdited],
    // TODO: Wait for 3 quiet seconds per card, then use the latest edit
  },
  async ({ event, step }) =>
    step.run("write-preview", () => writeCard({ prompt: event.data.prompt })),
);

export const functions = [regeneratePreview];
