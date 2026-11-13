import { writeCard } from "@12days/shared";
import { inngest } from "./client.js";
import { cardEditedBefore } from "./events.js";

// No debounce: every keystroke-sized edit starts its own run and bills its own LLM call.
export const regeneratePreviewBefore = inngest.createFunction(
  { id: "regenerate-preview-before", triggers: [cardEditedBefore] },
  async ({ event, step }) =>
    step.run("write-preview", () => writeCard({ prompt: event.data.prompt })),
);

export const beforeFunctions = [regeneratePreviewBefore];
