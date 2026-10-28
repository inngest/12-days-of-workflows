import type { ChildProcess } from "node:child_process";
import { listDays, resolveDay, startApp, startDevServer, stop } from "./lib.js";

const arg = process.argv[2];
if (!arg) {
  console.error("Usage: pnpm day NN   (or: pnpm day all)");
  process.exit(1);
}

const days =
  arg === "all" ? listDays().map((name) => resolveDay(name.slice(0, 2))) : [resolveDay(arg)];
const children: ChildProcess[] = [
  ...days.map((day) => startApp(day, { watch: true })),
  startDevServer(days),
];

process.on("SIGINT", async () => {
  await Promise.all(children.map(stop));
  process.exit(0);
});
