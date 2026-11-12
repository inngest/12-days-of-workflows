import { startServer } from "@12days/shared";
import { inngest } from "./client.js";
import { functions } from "./functions.js";

startServer({ client: inngest, functions });
