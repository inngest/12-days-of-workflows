import express from "express";
import type { Inngest, InngestFunction } from "inngest";
import { serve } from "inngest/express";
import { entries, reset } from "./ledger.js";

export function startServer(opts: {
  client: Inngest;
  functions: InngestFunction.Any[];
  port?: number; // default process.env.PORT
}): void {
  const port = opts.port ?? Number(process.env.PORT ?? 3000);
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

  app.listen(port, () => {
    console.log(`${opts.client.id} listening on http://localhost:${port}/api/inngest`);
  });
}
