import { startServer } from "@12days/shared";
import { beforeFunctions } from "./before.js";
import { inngest } from "./client.js";
import { functions } from "./functions.js";

const c1 = {
  cardId: "c1",
  prompt: "Merry Christmas, Grandma. Thanks for the cookies!",
  to: "grandma@example.com",
};

startServer({
  client: inngest,
  functions: [...functions, ...beforeFunctions],
  wall: {
    actions: [
      { kind: "button", label: "Request card c1", event: "card/requested", data: c1 },
      { kind: "button", label: "Approve c1", event: "card/approved", data: { cardId: "c1" } },
    ],
  },
});
