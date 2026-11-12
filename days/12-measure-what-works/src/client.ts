import { chaosMiddleware } from "@12days/shared";
import { Inngest } from "inngest";
import { scoreMiddleware } from "inngest/experimental";

export const inngest = new Inngest({
  id: "day-12",
  middleware: [chaosMiddleware, scoreMiddleware()],
});
