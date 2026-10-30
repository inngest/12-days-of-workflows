import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import express from "express";
import type { Inngest, InngestFunction } from "inngest";
import { serve } from "inngest/express";
import { entries, reset } from "./ledger.js";

/** A control on the ledger wall that sends one event. "text" sends on every keystroke. */
export type WallAction =
  | { kind: "button"; label: string; event: string; data: Record<string, unknown> }
  | { kind: "text"; label: string; event: string; data: Record<string, unknown>; field: string };

const wallPage = new URL("./wall.html", import.meta.url);

/** The day's README heading, e.g. "Day 04: How do I wait…". The app runs from its day folder. */
function dayTitle(fallback: string): string {
  const readme = join(process.cwd(), "README.md");
  if (!existsSync(readme)) return fallback;
  return readFileSync(readme, "utf8").split("\n")[0].replace(/^#\s*/, "") || fallback;
}

export function startServer(opts: {
  client: Inngest;
  functions: InngestFunction.Any[];
  port?: number; // default process.env.PORT
  wall?: { actions?: WallAction[] };
}): void {
  const port = opts.port ?? Number(process.env.PORT ?? 3000);
  const actions = opts.wall?.actions ?? [];
  const app = express();
  app.use(express.json({ limit: "1mb" }));
  app.use("/api/inngest", serve({ client: opts.client, functions: opts.functions }));

  // Test-only routes used by `pnpm check`.
  app.get("/__ledger", (_req, res) => {
    res.json(entries());
  });
  app.delete("/__ledger", (_req, res) => {
    reset();
    res.status(204).end();
  });

  // The ledger wall: an on-camera view of the ledger, plus the day's wall actions.
  app.get("/", (_req, res) => {
    res.type("html").send(readFileSync(wallPage, "utf8"));
  });
  app.get("/__wall", (_req, res) => {
    res.json({ appId: opts.client.id, title: dayTitle(opts.client.id), actions });
  });
  app.post("/__event", async (req, res) => {
    const { name, data } = req.body as { name?: string; data?: Record<string, unknown> };
    if (!actions.some((a) => a.event === name)) {
      res.status(400).json({ error: `"${name}" is not a wall action for this day` });
      return;
    }
    const { ids } = await opts.client.send({ name: name as string, data: data ?? {} });
    res.json({ ids });
  });

  app.listen(port, () => {
    console.log(`${opts.client.id} listening on http://localhost:${port}/api/inngest`);
    console.log(`${opts.client.id} ledger wall on http://localhost:${port}`);
  });
}
