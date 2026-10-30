import { startServer } from "@12days/shared";
import { inngest } from "./client.js";
import { functions } from "./functions.js";

startServer({
  client: inngest,
  functions,
  wall: {
    actions: [
      {
        kind: "button",
        label: "Request card c1",
        event: "card/requested",
        data: { cardId: "c1", prompt: "Happy holidays to the whole team", to: "jason@example.com" },
      },
      { kind: "button", label: "Approve c1", event: "card/approved", data: { cardId: "c1" } },
    ],
  },
});
