import { chaosMiddleware } from "@12days/shared";
import { Inngest } from "inngest";
import { sandboxMiddleware, scoreMiddleware } from "inngest/experimental";

export const inngest = new Inngest({
  id: "day-12b",
  middleware: [chaosMiddleware, scoreMiddleware(), sandboxMiddleware()],
});
