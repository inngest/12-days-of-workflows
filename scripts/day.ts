import type { ChildProcess } from "node:child_process";
import {
  dayId,
  listDays,
  requireEnv,
  resolveDay,
  sharedScenarioEnv,
  startApp,
  startDevServer,
  stop,
} from "./lib.js";

// Usage: pnpm day NN [--cloud]   (or: pnpm day all)
// --cloud skips the Dev Server and connects the app to Inngest Cloud instead.
const cloud = process.argv.includes("--cloud");
const arg = process.argv.slice(2).find((a) => a !== "--cloud");
if (!arg || (cloud && arg === "all")) {
  console.error("Usage: pnpm day NN [--cloud]   (or: pnpm day all)");
  process.exit(1);
}
if (cloud) requireEnv(["INNGEST_SIGNING_KEY", "INNGEST_EVENT_KEY"]);

// Day 12b is parked, so "all" leaves it out; `pnpm day 12b` still starts it.
const days =
  arg === "all"
    ? listDays()
        .filter((name) => dayId(name) !== "12b")
        .map((name) => resolveDay(dayId(name)))
    : [resolveDay(arg)];
const children: ChildProcess[] = await Promise.all(
  days.map(async (day) => startApp(day, { watch: true, cloud, env: await sharedScenarioEnv(day) })),
);
if (cloud) {
  console.log("Cloud mode: watch runs at https://app.inngest.com (no local Dev Server).");
} else {
  children.push(startDevServer(days));
}

process.on("SIGINT", async () => {
  await Promise.all(children.map(stop));
  process.exit(0);
});
