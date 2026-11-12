import { startServer } from "@12days/shared";
import { beforeFunctions } from "./before.js";
import { inngest } from "./client.js";
import { functions } from "./functions.js";

startServer({ client: inngest, functions: [...functions, ...beforeFunctions] });
