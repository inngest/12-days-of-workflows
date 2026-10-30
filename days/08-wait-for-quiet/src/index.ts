import { startServer } from "@12days/shared";
import { beforeFunctions } from "./before.js";
import { inngest } from "./client.js";
import { functions } from "./functions.js";

startServer({
  client: inngest,
  functions: [...functions, ...beforeFunctions],
  wall: {
    actions: [
      {
        kind: "text",
        label: "Card message",
        event: "card/edited",
        data: { cardId: "c1" },
        field: "prompt",
      },
      {
        kind: "text",
        label: "Card message (no debounce)",
        event: "card/edited.before",
        data: { cardId: "c1" },
        field: "prompt",
      },
    ],
  },
});
