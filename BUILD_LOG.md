# Build log

Notes on how this repo was built, one section per phase. These are raw material for a blog post, not a changelog.

## Phase 0: scaffold

- Started from a written spec and asked Claude Code to build one phase per session. Each session stays small, and every phase ends in a diff someone can actually review.
- Each phase has a gate command that must pass. For the scaffold it's just install, lint and typecheck. Boring on purpose.
- Pulled Inngest's official Claude Code skills into the repo. They might lag the v4 SDK, so `CLAUDE.md` says our rules win wherever the two disagree.
- First surprise: Biome now formats Markdown too. It immediately tried to reformat the spec we'd asked to keep verbatim, so Markdown is out of Biome's reach.
- Second surprise: Biome's own config migration quietly switched every lint rule off (`"preset": "none"`). We caught it in review and set it back to `recommended`. Worth a look whenever a tool auto-migrates your config.
- The pinned pnpm 9 just worked even though the machine runs pnpm 11. pnpm read the `packageManager` field and switched versions by itself.
- The spec had a tight dependency allowlist and left out `@types/node`, which nearly every script needs. We loosened the rule: `@types/*` packages get installed without asking, and anything else gets proposed if it makes the code read better on camera.
- Bet for Phase 1: the shared package exports raw TypeScript, so `tsx` runs it with no build step. We'll find out whether `tsc -b` agrees once a day imports from it.

## Phase 1: shared, runner, Day 01

- Built the fake-services package first: an LLM that bills, an image API that rate-limits and fails on command, a console mailer. Every fake writes to a ledger, so "did we pay twice?" becomes something a test can count instead of something you squint at in logs.
- Chaos rides in the event itself (`event.data.chaos`). A small v4 middleware drops it into `AsyncLocalStorage` before the function runs, so lesson code never mentions failure injection. v4 middleware turned out to be class-based, which the spec hadn't pinned down; it slotted in with no fuss.
- The Phase 0 bet paid off: the shared package still exports raw TypeScript, and `tsc -b` with project references typechecks a day against it without any build step.
- Day 01 tells the story in the ledger. Without steps, two image failures bill the LLM three times. Wrap each call in `step.run()` and the LLM bills once while only the image retries.
- Surprise: the Dev Server's REST endpoint for an event's runs says `Failed` for a run that is merely between retries. Its GraphQL API reports `RUNNING` correctly and can also list every run in a time window, including runs no event triggered. That settled the spec's open question about invoked and fan-out runs: no ledger-only fallback needed.
- Retries are slow on purpose. We measured the Dev Server: two failures take 80–105 s, and exhausting the default four retries takes about five minutes. Day 01's failure scenarios wait two minutes before asserting, so its check takes about four. Later "-before" days that exhaust retries will need a human call on speed.
- Lost one measurement to our own tooling: auto-formatting the shared package made `tsx watch` restart the app mid-run, which wiped the in-memory failure counters. The rerun used a non-watch app.
- Small spec gaps got the boring fix: `index.ts` serves the `-before` functions too, and scenarios send chaos as raw event data so `CardRequest` stays clean on camera.
