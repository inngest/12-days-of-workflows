import { loadDay, requireEnv, resolveDay, sleep } from "./lib.js";

// --cloud sends to Inngest Cloud (needs INNGEST_EVENT_KEY) instead of the local Dev Server.
const cloud = process.argv.includes("--cloud");
if (cloud) requireEnv(["INNGEST_EVENT_KEY"]);
else process.env.INNGEST_DEV = "1";

const [dayArg, name = "happy"] = process.argv.slice(2).filter((a) => a !== "--cloud");
if (!dayArg) {
  console.error("Usage: pnpm send NN [scenario | --list] [--cloud]");
  process.exit(1);
}
const { inngest, mod } = await loadDay(resolveDay(dayArg));

if (name === "--list") {
  for (const [key, scenario] of Object.entries(mod.scenarios)) {
    console.log(`${key.padEnd(28)} ${scenario.description}`);
  }
  process.exit(0);
}

const scenario = mod.scenarios[name];
if (!scenario) {
  const valid = Object.keys(mod.scenarios).join("\n  ");
  console.error(`Unknown scenario "${name}". Valid scenarios:\n  ${valid}`);
  process.exit(1);
}
const ids = await scenario.send({ inngest, sleep });
console.log(`Sent ${ids.length} event(s):\n  ${ids.join("\n  ")}`);
