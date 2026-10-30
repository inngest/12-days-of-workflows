# 12 Days of Workflows

Teaching repo: 12 standalone Inngest examples, one per day, in `days/NN-slug/`.
Beginners read this code on camera. Readability beats cleverness, always.
Full task spec: SPEC.md.

## Commands
- `pnpm install`
- `pnpm day NN` — runs day NN on port 30NN plus the Dev Server on :8288
- `pnpm send NN [scenario]` — fires a scenario's events
- `pnpm check [NN]` — typecheck + scenario assertions (all days if NN omitted)
- `pnpm starters` — regenerates the `starter` branch
- `pnpm lint`

## Inngest SDK rules (TypeScript v4, `inngest@^4.8.0`)
- Never write v3 syntax. If an example you recall has a second
  trigger argument to createFunction, it is v3.
- Triggers live in the options object: `{ id, triggers: [...] }`.
- Events: `eventType(name, { schema: staticSchema<T>() })`. `T` must be
  a `type`, not an `interface`. No `EventSchemas`.
- `step.invoke` takes a function instance or `referenceFunction()`,
  never a string id.
- All event payload goes in `event.data`. `event.user` does not exist.
- v4 defaults to cloud mode. Only `scripts/day.ts` sets `INNGEST_DEV=1`;
  never hardcode `isDev: true`.
- Checkpointing is on by default. Leave it on.
- Agent Evals (Day 12 only): `scoreMiddleware()` from
  `inngest/experimental` must be on the client.

## Code rules
- Step ids are kebab-case verb phrases (`write-text`); they appear on screen.
- Lesson code (inside `@lesson` markers) stays within the day's line budget.
  Over budget: stop and ask.
- Days import only from `inngest` and `@12days/shared`. Never from another day.
- Never change `@12days/shared` to make one day work. If a day needs a new
  fake behavior, propose the contract change and stop.
- Fakes are deterministic: seeded RNG only, no network unless `USE_REAL_LLM=1`.
- At most one comment per Inngest concept in `functions.ts`.
  Explanations go in the day's README.
- Allowed dependencies: inngest, express, @types/express, tsx, typescript,
  vitest, @biomejs/biome, zod (Day 12 only), and any `@types/*` package.
  Anything else: ask, especially if it would make the code easier to read
  on camera.

## Build log
- At the end of every phase, add a `## Phase N: <name>` section to
  `BUILD_LOG.md`: 5–10 conversational bullets on what we built, what
  surprised us, and the decisions we made. It feeds a blog post, so tell
  the story; don't dump file lists, versions or test output.

## Notion tech spec
- Video outlines and per-day graphics are built from the Notion page
  "12 Days of Workflows - Tech Spec":
  https://app.notion.com/p/inngest/12-Days-of-Workflows-Tech-Spec-409b64753bbd80939db3d5e950d670d8
- Its table (hook, demo beat, takeaway, visual concept) must match what the
  code demos: counts, timings, failure numbers, function and step names.
- At the end of every phase, or whenever a change alters a day's demo, fetch
  the page and fix factual drift (numbers, primitives). Framing changes to a
  hook, takeaway or visual concept are the team's call: flag them, don't rewrite.

## On camera
- Every day is a short video episode, so every scenario a README tells viewers
  to run must resolve snappily: visibly done in under 60 s, ideally under 20 s.
- Get slow behavior (retries, sleeps, timeouts, rate windows) down to seconds
  with scenario `env` or config. Never make the viewer sit through it.
- Can't make a lesson's scenario that fast without changing what it teaches:
  stop and ask.

## Docs (fetch before writing a day; LLM-friendly markdown)
- v3→v4 changes: https://www.inngest.com/docs-markdown/reference/typescript/v4/migrations/v3-to-v4
- Retries: https://www.inngest.com/docs-markdown/durable-execution/guides-and-advanced/error-handling/retries
- Errors: https://www.inngest.com/docs/durable-execution/guides-and-advanced/error-handling/inngest-errors.md
- Cancel on: https://www.inngest.com/docs/reference/typescript/v4/functions/cancel-on.md
- Flow control index: https://www.inngest.com/docs/durable-execution/flow-control.md
- Throttling: https://www.inngest.com/docs/durable-execution/flow-control/throttling.md
- Debounce: https://www.inngest.com/docs/durable-execution/flow-control/debounce.md
- Batching: https://www.inngest.com/docs/durable-execution/flow-control/batching.md
- Agent Evals quick start: https://www.inngest.com/docs/agent-evals/quick-start.md
- Agent Evals reference: https://www.inngest.com/docs/agent-evals/reference.md
