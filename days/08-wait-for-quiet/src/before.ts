import { writeCard } from "@12days/shared";
import { eventType, staticSchema } from "inngest";
import { inngest } from "./client.js";
import type { CardEdit } from "./events.js";

const cardEditedBefore = eventType("card/edited.before", {
  schema: staticSchema<CardEdit>(),
});

// No debounce: every keystroke starts a run, and every run bills an LLM call.
export const regeneratePreviewBefore = inngest.createFunction(
  { id: "regenerate-preview-before", triggers: [cardEditedBefore] },
  async ({ event, step }) =>
    step.run("write-preview", () => writeCard({ prompt: event.data.prompt })),
);

export const beforeFunctions = [regeneratePreviewBefore];
