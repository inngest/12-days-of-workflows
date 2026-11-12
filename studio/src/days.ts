import type { Scenario } from "@12days/shared";
import { type Day, dayId, listDays, loadDay, resolveDay } from "../../scripts/lib.js";
import { PROFILES } from "./profiles.js";

/** Both Inngest keys are set in the studio's environment. Their values are never read or shown. */
export const hasCloudKeys = () =>
  Boolean(process.env.INNGEST_SIGNING_KEY && process.env.INNGEST_EVENT_KEY);

/**
 * Cloud mode is automatic: the keys are set and the day is one that wants Inngest Cloud
 * (Days 12 and 12b). Every other day keeps using the local Dev Server, keys or not.
 */
export function cloudModeFor(nn: string): boolean {
  const profile = PROFILES[nn];
  return hasCloudKeys() && Boolean(profile?.cloudOnly || profile?.needsCloud);
}

/** Loads a day's client in the mode that fits it: the Dev Server, or Inngest Cloud (event key). */
async function loadForMode(day: Day) {
  // The client reads INNGEST_DEV when it is created, so set it before the day is imported.
  if (cloudModeFor(day.nn)) delete process.env.INNGEST_DEV;
  else process.env.INNGEST_DEV = "1";
  return loadDay(day);
}

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
  const { mod } = await loadForMode(day);
  return mod.scenarios;
}

export async function listScenarios(nn: string): Promise<ScenarioInfo[]> {
  const scenarios = await loadScenarios(resolveDay(nn));
  return Object.entries(scenarios).map(([name, s]) => ({
    name,
    description: s.description,
    env: s.env ?? {},
    needsCloud: false, // the shared Scenario type has no cloud-only flag today
  }));
}

/** Fires a scenario's events, exactly like `pnpm send NN scenario`. */
export async function fireScenario(nn: string, name: string): Promise<void> {
  const day = resolveDay(nn);
  const { inngest, mod } = await loadForMode(day);
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
  const { inngest } = await loadForMode(resolveDay(nn));
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
