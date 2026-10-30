import { chaosMiddleware } from "@12days/shared";
import { Inngest } from "inngest";

export const inngest = new Inngest({ id: "day-09", middleware: [chaosMiddleware] });
