import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { listDays, NO_EMIT_PROJECTS, ROOT } from "./lib.js";

// Usage: pnpm starters [--push]
// Rebuilds the `starter` branch from HEAD without touching the main working tree. Each day's
// hand-maintained starter files in days/NN-slug/starter/ are laid over the finished day.

const push = process.argv.includes("--push");

/** Runs git and returns trimmed stdout, or null if it failed. */
function git(args: string[], cwd = ROOT): string | null {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : null;
}

function mustGit(args: string[], cwd = ROOT): string {
  const out = git(args, cwd);
  if (out === null) throw new Error(`git ${args.join(" ")} failed`);
  return out;
}

function run(label: string, command: string, args: string[], cwd: string) {
  console.log(`> ${label}`);
  const result = spawnSync(command, args, { cwd, stdio: "inherit" });
  if (result.status !== 0) throw new Error(`${label} failed`);
}

const mainSha = mustGit(["rev-parse", "--short", "HEAD"]);
const worktree = join(mkdtempSync(join(tmpdir(), "12days-starter-")), "repo");
mustGit(["worktree", "add", "--detach", worktree, "HEAD"]);

try {
  // 1. Lay each day's checked-in starter files over the finished code, then drop the copies.
  for (const name of listDays()) {
    const starter = join(worktree, "days", name, "starter");
    if (existsSync(starter)) {
      cpSync(starter, join(worktree, "days", name), { recursive: true });
      console.log(`overlaid days/${name}/starter`);
      rmSync(starter, { recursive: true, force: true });
    }
  }

  // 2. The starter must typecheck, or viewers start from broken code.
  run("pnpm install", "pnpm", ["install", "--frozen-lockfile", "--prefer-offline"], worktree);
  try {
    run("tsc -b", join(worktree, "node_modules/.bin/tsc"), ["-b"], worktree);
    for (const project of NO_EMIT_PROJECTS) {
      const tsc = join(worktree, "node_modules/.bin/tsc");
      run(`tsc ${project}`, tsc, ["--noEmit", "-p", project], worktree);
    }
  } catch (err) {
    console.error("Starter does not typecheck. Update days/NN-slug/starter/ to match src/.");
    throw err;
  }

  // 3. Commit onto `starter` with plumbing, so no branch is ever checked out.
  mustGit(["add", "-A"], worktree);
  const tree = mustGit(["write-tree"], worktree);
  const parent =
    git(["rev-parse", "--verify", "--quiet", "refs/heads/starter"]) ??
    git(["rev-parse", "--verify", "--quiet", "refs/remotes/origin/starter"]) ??
    mustGit(["rev-parse", "HEAD"]);

  if (mustGit(["rev-parse", `${parent}^{tree}`]) === tree) {
    console.log(`starter up to date (main ${mainSha})`);
  } else {
    const commit = mustGit(["commit-tree", tree, "-p", parent, "-m", `starter: ${mainSha}`]);
    mustGit(["update-ref", "refs/heads/starter", commit]);
    console.log(`starter -> ${commit.slice(0, 7)} (starter: ${mainSha})`);
  }

  if (push) run("git push", "git", ["push", "origin", "starter"], ROOT);
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  git(["worktree", "remove", "--force", worktree]);
}
