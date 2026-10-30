import { type ChildProcess, spawn } from "node:child_process";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { Scenario } from "@12days/shared";
import type { Inngest } from "inngest";

export const ROOT = join(import.meta.dirname, "..");
export const DEV_SERVER = "http://localhost:8288";

/**
 * Projects outside the `tsc -b` graph, typechecked with `tsc --noEmit -p`. Day 12's scoring types
 * reference an SDK type that isn't exported, so a composite (declaration-emitting) build can't
 * name them.
 */
export const NO_EMIT_PROJECTS = ["days/12-measure-what-works"];

export type Day = { nn: string; dir: string; port: number };

export function listDays(): string[] {
  return readdirSync(join(ROOT, "days"))
    .filter((name) => /^\d\d-/.test(name))
    .sort();
}

/** Resolves "1" or "01" to its `days/01-*` folder, or exits listing the days that exist. */
export function resolveDay(input: string): Day {
  const nn = input.padStart(2, "0");
  const matches = listDays().filter((name) => name.startsWith(`${nn}-`));
  if (matches.length !== 1) {
    console.error(`No single day matches "${input}". Days:\n  ${listDays().join("\n  ")}`);
    process.exit(1);
  }
  return { nn, dir: join(ROOT, "days", matches[0]), port: 3000 + Number(nn) };
}

/** Spawns a process in its own group, prefixing each output line with `[label]`. */
export function spawnPrefixed(
  label: string,
  command: string,
  args: string[],
  opts: { cwd?: string; env?: Record<string, string>; onLine?: (line: string) => void } = {},
): ChildProcess {
  const child = spawn(command, args, {
    cwd: opts.cwd ?? ROOT,
    env: { ...process.env, ...opts.env },
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
  for (const stream of [child.stdout, child.stderr]) {
    let buffered = "";
    stream?.on("data", (chunk: Buffer) => {
      buffered += chunk.toString();
      const lines = buffered.split("\n");
      buffered = lines.pop() ?? "";
      for (const line of lines) {
        if (opts.onLine) opts.onLine(line);
        else console.log(`[${label}] ${line}`);
      }
    });
  }
  return child;
}

type OutputOpts = { onLine?: (line: string) => void };

export function startApp(
  day: Day,
  opts: OutputOpts & { watch?: boolean; cloud?: boolean; env?: Record<string, string> } = {},
) {
  const args = opts.watch ? ["watch", "src/index.ts"] : ["src/index.ts"];
  // Cloud mode leaves INNGEST_DEV unset, so the SDK uses INNGEST_SIGNING_KEY from the env.
  const mode: Record<string, string> = opts.cloud ? { USE_CONNECT: "1" } : { INNGEST_DEV: "1" };
  return spawnPrefixed("app", join(ROOT, "node_modules/.bin/tsx"), args, {
    cwd: day.dir,
    env: { ...opts.env, PORT: String(day.port), ...mode },
    onLine: opts.onLine,
  });
}

export function startDevServer(days: Day[], opts: OutputOpts = {}) {
  const urls = days.flatMap((day) => ["-u", `http://localhost:${day.port}/api/inngest`]);
  return spawnPrefixed(
    "dev",
    "npx",
    ["--yes", "--ignore-scripts=false", "inngest-cli@latest", "dev", "--no-discovery", ...urls],
    { onLine: opts.onLine },
  );
}

/** Kills a child's whole process group (tsx and npx both spawn grandchildren). */
export function stop(child: ChildProcess): Promise<void> {
  const pid = child.pid;
  if (child.exitCode !== null || pid === undefined) return Promise.resolve();
  return new Promise((resolve) => {
    child.once("exit", () => resolve());
    try {
      process.kill(-pid, "SIGTERM");
    } catch {
      resolve();
    }
  });
}

/** Exits with a hint unless every named env var is set. Cloud mode needs real Inngest keys. */
export function requireEnv(names: string[]) {
  const missing = names.filter((name) => !process.env[name]);
  if (missing.length === 0) return;
  console.error(`--cloud needs ${missing.join(" and ")} set (from your Inngest environment).`);
  process.exit(1);
}

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function waitFor(what: string, ready: () => Promise<boolean>, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await ready().catch(() => false)) return;
    await sleep(250);
  }
  throw new Error(`Timed out after ${timeoutMs} ms waiting for ${what}`);
}

export type DayModule = { lessonBudget: number; scenarios: Record<string, Scenario> };

/** Imports a day's client and its `send.ts`. Callers set INNGEST_DEV=1 first. */
export async function loadDay(day: Day): Promise<{ inngest: Inngest; mod: DayModule }> {
  const client = await import(pathToFileURL(join(day.dir, "src/client.ts")).href);
  const mod: DayModule = await import(pathToFileURL(join(day.dir, "send.ts")).href);
  return { inngest: client.inngest, mod };
}

// ---------- @lesson markers ----------

/** The only files allowed to hold @lesson regions, relative to a day folder. */
export const LESSON_FILES = ["src/functions.ts", "src/events.ts"];

type LessonLine = { kind: "start" | "end" | "stub" | "inside" | "outside"; line: string };

/** Classifies each line by marker. Throws on nested, unclosed or stray markers. */
function parseLessons(source: string, file: string): LessonLine[] {
  const parsed: LessonLine[] = [];
  let inside = false;
  source.split("\n").forEach((line, i) => {
    const text = line.trim();
    const where = `${file}:${i + 1}`;
    if (text.startsWith("// @lesson:start")) {
      if (inside) throw new Error(`${where}: nested @lesson:start`);
      inside = true;
      parsed.push({ kind: "start", line });
    } else if (text.startsWith("// @lesson:end")) {
      if (!inside) throw new Error(`${where}: @lesson:end without start`);
      inside = false;
      parsed.push({ kind: "end", line });
    } else if (text.startsWith("// @lesson:stub")) {
      if (!inside) throw new Error(`${where}: @lesson:stub outside a region`);
      parsed.push({ kind: "stub", line });
    } else {
      parsed.push({ kind: inside ? "inside" : "outside", line });
    }
  });
  if (inside) throw new Error(`${file}: unclosed @lesson:start`);
  return parsed;
}

/** Non-blank lines inside @lesson regions, excluding stubs. */
export function countLessonLines(source: string, file: string): number {
  return parseLessons(source, file).filter((l) => l.kind === "inside" && l.line.trim() !== "")
    .length;
}

/**
 * Rewrites a lesson file for the starter branch: each region becomes `// TODO: <text>`
 * followed by its uncommented stubs; everything else in the region is dropped.
 */
export function toStarter(source: string, file: string): string {
  const out: string[] = [];
  for (const { kind, line } of parseLessons(source, file)) {
    if (kind === "start") out.push(line.replace("// @lesson:start", "// TODO:"));
    if (kind === "stub") out.push(line.replace(/\/\/ @lesson:stub ?/, ""));
    if (kind === "outside") out.push(line);
  }
  return out.join("\n");
}
