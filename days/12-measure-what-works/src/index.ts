import { startServer } from "@12days/shared";
import { inngest } from "./client.js";
import { functions } from "./functions.js";

const c1 = { cardId: "c1", prompt: "Happy holidays to the whole team", to: "jason@example.com" };

startServer({
  client: inngest,
  functions,
  wall: {
    actions: [
      { kind: "button", label: "Request card c1", event: "card/requested", data: c1 },
      {
        kind: "button",
        label: "c1: Loved it",
        event: "card/reacted",
        data: { cardId: "c1", loved: true },
      },
      {
        kind: "button",
        label: "c1: Meh",
        event: "card/reacted",
        data: { cardId: "c1", loved: false },
      },
    ],
  },
});
