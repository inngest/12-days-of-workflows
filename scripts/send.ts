import { loadDay, resolveDay, sleep } from "./lib.js";

process.env.INNGEST_DEV = "1";

const [dayArg, given] = process.argv.slice(2);
const name = given ?? "happy";
if (!dayArg) {
  console.error("Usage: pnpm send NN [scenario | --list]");
  process.exit(1);
}
const { inngest, mod } = await loadDay(resolveDay(dayArg));

const list = () => {
  for (const [key, scenario] of Object.entries(mod.scenarios)) {
    console.log(`${key.padEnd(28)} ${scenario.description}`);
  }
};

if (name === "--list") {
  list();
  process.exit(0);
}

// Only Days 01 to 03 have a "happy" scenario, so without a name, show what this day offers.
if (given === undefined && !mod.scenarios.happy) {
  console.error(
    `Day ${dayArg} has no "happy" scenario. Pick one: pnpm send ${dayArg} <scenario>\n`,
  );
  list();
  process.exit(1);
}

const scenario = mod.scenarios[name];
if (!scenario) {
  const valid = Object.keys(mod.scenarios).join("\n  ");
  console.error(`Unknown scenario "${name}". Valid scenarios:\n  ${valid}`);
  process.exit(1);
}
const ids = await scenario.send({ inngest, sleep });
console.log(`Sent ${ids.length} event(s):\n  ${ids.join("\n  ")}`);
