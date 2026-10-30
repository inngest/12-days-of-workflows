import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LESSON_FILES, listDays, NO_EMIT_PROJECTS, ROOT, toStarter } from "./lib.js";

// Usage: pnpm starters [--push]
// Rebuilds the `starter` branch from HEAD without touching the main working tree.

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
  // 1. Rewrite every lesson file in place.
  for (const name of listDays()) {
    for (const file of LESSON_FILES) {
      const path = join(worktree, "days", name, file);
      if (!existsSync(path)) continue;
      const source = readFileSync(path, "utf8");
      if (!source.includes("@lesson:start")) continue;
      writeFileSync(path, toStarter(source, `days/${name}/${file}`));
      console.log(`rewrote days/${name}/${file}`);
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
    console.error("Starter does not typecheck. Missing a @lesson:stub?");
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
