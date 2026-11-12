import type { Scenario } from "@12days/shared";
import { type Day, dayId, listDays, loadDay, resolveDay } from "../../scripts/lib.js";

// The days send events to the Dev Server, so this process talks to it like `pnpm send` does.
process.env.INNGEST_DEV = "1";

export type AliveDay = { nn: string; title: string; port: number; lastActivity: number };

/** "01-survive-failure" becomes "Survive failure". */
function titleOf(folder: string): string {
  const words = folder.split("-").slice(1).join(" ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

type LedgerRow = { at: number };

export async function readLedger(port: number): Promise<LedgerRow[] | null> {
  try {
    const res = await fetch(`http://localhost:${port}/__ledger`, {
      signal: AbortSignal.timeout(700),
    });
    return res.ok ? ((await res.json()) as LedgerRow[]) : null;
  } catch {
    return null; // nothing is listening on that port
  }
}

/** Every day whose app answers on its port right now. */
export async function findAliveDays(): Promise<AliveDay[]> {
  const folders = listDays();
  const found = await Promise.all(
    folders.map(async (folder) => {
      const day = resolveDay(dayId(folder));
      const ledger = await readLedger(day.port);
      if (!ledger) return null;
      const lastActivity = Math.max(0, ...ledger.map((e) => e.at));
      return { nn: day.nn, title: titleOf(folder), port: day.port, lastActivity };
    }),
  );
  return found.filter((d) => d !== null);
}

export type ScenarioInfo = {
  name: string;
  description: string;
  env: Record<string, string>;
  needsCloud: boolean;
};

/** The day's scenarios, read from its send.ts (the same file `pnpm send` uses). */
async function loadScenarios(day: Day): Promise<Record<string, Scenario>> {
  const { mod } = await loadDay(day);
  return mod.scenarios;
}

export async function listScenarios(nn: string): Promise<ScenarioInfo[]> {
  const scenarios = await loadScenarios(resolveDay(nn));
  return Object.entries(scenarios).map(([name, s]) => ({
    name,
    description: s.description,
    env: s.env ?? {},
    needsCloud: s.requiresEnv !== undefined,
  }));
}

/** Fires a scenario's events, exactly like `pnpm send NN scenario`. */
export async function fireScenario(nn: string, name: string): Promise<void> {
  const day = resolveDay(nn);
  const { inngest, mod } = await loadDay(day);
  const scenario = mod.scenarios[name];
  if (!scenario) throw new Error(`Day ${nn} has no scenario called ${name}`);
  const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
  await scenario.send({ inngest, sleep });
}

/** Sends events through the day's own client, wave by wave, like a scenario does. */
export async function sendWaves(
  nn: string,
  waves: { name: string; data: Record<string, unknown> }[][],
  pauseMs = 300,
): Promise<void> {
  const { inngest } = await loadDay(resolveDay(nn));
  for (const [i, events] of waves.entries()) {
    if (i > 0) await new Promise<void>((resolve) => setTimeout(resolve, pauseMs));
    await inngest.send(events);
  }
}

export async function clearLedger(port: number): Promise<void> {
  await fetch(`http://localhost:${port}/__ledger`, {
    method: "DELETE",
    signal: AbortSignal.timeout(2000),
  });
}
