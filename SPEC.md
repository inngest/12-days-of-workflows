# 12 Days of Workflows — Repo Spec

Oct 27, 2026 · @Mitchell

Build spec for Claude Code: a pnpm monorepo of 12 standalone Inngest v4 TypeScript examples, built in six phases, each gated by a command that must pass.

## How to use this spec

Export this doc as Markdown, commit it as `SPEC.md`, and commit the next section's code block as `CLAUDE.md`. Run one phase of the Build order per Claude Code session.

- **Session prompt.** Start each session in plan mode with the prompt below. One phase per session keeps context small and leaves a reviewable diff.
- **Reference code is the target shape,** written against v4 docs on 2026-10-27. Claude Code still fetches the docs URLs in `CLAUDE.md` before writing each day, because the SDK moves.
- **Scenario tables are the tests.** Every row in a day's table becomes an assertion in `pnpm check NN`. A day is done when its check passes, not when it compiles.
- **Stop-and-ask items are human calls.** Claude Code writes `// TODO(human): <question>` and keeps going on everything else.

```text
Read SPEC.md and CLAUDE.md. Execute Phase <N> of "Build order" only.
Before writing any Inngest code, fetch the docs URLs listed in CLAUDE.md
for the primitives this phase uses and note any API differences from SPEC.md.
Stop at the phase gate, run the gate command, and report: what passed,
what failed, and any spec/API mismatches you found.
```

## CLAUDE.md

Commit this block verbatim as `CLAUDE.md` at the repo root. It carries the rules that apply to every session, so `SPEC.md` can stay task-focused.

Also install Inngest's official Claude Code skills into the repo's `.claude/skills/` from [inngest/inngest-skills](https://github.com/inngest/inngest-skills). They may lag v4, so the rules below win wherever they disagree.

```markdown
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
  vitest, @biomejs/biome, zod (Day 12 only). Anything else: stop and ask.

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
```

## Repo layout and root scripts

pnpm 9 workspace, Node 22, ESM, strict TypeScript. Root scripts are thin `tsx` wrappers so every command is one word for viewers.

```
12-days-of-workflows/
├─ CLAUDE.md
├─ SPEC.md
├─ package.json
├─ pnpm-workspace.yaml        # packages: ["packages/*", "days/*", "finale"]
├─ tsconfig.base.json         # strict, module/moduleResolution nodenext, target es2022
├─ biome.json
├─ .github/workflows/ci.yml   # pnpm check, then pnpm starters on main
├─ packages/shared/           # @12days/shared (see contract)
├─ days/01-survive-failure/ … days/12-measure-what-works/
├─ finale/                    # empty scaffold until the livestream build is specced
└─ scripts/
   ├─ day.ts
   ├─ send.ts
   ├─ check.ts
   └─ make-starters.ts
```

```json
{
  "name": "12-days-of-workflows",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@9.15.0",
  "engines": { "node": ">=22" },
  "scripts": {
    "day": "tsx scripts/day.ts",
    "send": "tsx scripts/send.ts",
    "check": "tsx scripts/check.ts",
    "starters": "tsx scripts/make-starters.ts",
    "lint": "biome check ."
  }
}
```

**`scripts/day.ts` behavior**

1. Resolve `NN` to the single folder matching `days/NN-*`. Exit 1 with the list of days if none matches.
2. Spawn the day's app: `tsx watch src/index.ts` with `PORT=30NN` and `INNGEST_DEV=1`.
3. Spawn the Dev Server: `npx --ignore-scripts=false inngest-cli@latest dev --no-discovery -u http://localhost:30NN/api/inngest`.
4. Prefix each process's output (`[app]`, `[dev]`) and kill both on SIGINT.
5. `pnpm day all` starts all 12 apps and one Dev Server with twelve `-u` flags, for the finale.

**Cloud mode.** `pnpm day NN --cloud` starts only the app, with `USE_CONNECT=1` and no `INNGEST_DEV`; `startServer` then calls `connect()` from `inngest/connect` instead of mounting `serve()`, so Inngest Cloud reaches a laptop over an outbound WebSocket. The ledger and wall routes stay local. `pnpm send NN [scenario] --cloud` sends with the event key instead of to the Dev Server. Both exit with a hint unless `INNGEST_SIGNING_KEY` (day) and `INNGEST_EVENT_KEY` are set. `pnpm check` always uses the Dev Server.

**`scripts/send.ts` behavior:** imports `days/NN-*/send.ts`, runs the named scenario (default `happy`) with `INNGEST_DEV=1`, and prints the sent event ids. Unknown scenario names exit 1 and list the valid ones.

## packages/shared contract

`@12days/shared` is the only code no viewer edits. It fakes every external service so failures are deterministic and nobody needs API keys. Implement exactly this surface; changes go through Stop and ask.

```ts
// errors.ts
export class ProviderError extends Error {
  constructor(public status: 429 | 500, public retryAfterMs?: number);
}

// fakes/llm.ts — ~800 ms; text derived from a hash of the input
export type WriteCardInput = { prompt: string; cardId?: string; tone?: string; variant?: string };
export type CardText = { text: string; tokens: number; costUsd: number };
export function writeCard(input: WriteCardInput): Promise<CardText>;

// fakes/image.ts — 1–3 s seeded latency; global token bucket IMAGE_RATE
// (default 5/10s: burst of 5, then 1 call per 2 s), above it throws ProviderError(429, msUntilFree)
export function renderImage(input: { text: string }): Promise<{ url: string }>;

// fakes/mail.ts — console only
export function sendCard(input: { to: string; cardId: string }): Promise<{ deliveredAt: string }>;
export function notifySender(cardId: string, reason: string): Promise<void>;

// fakes/moderation.ts — rejects prompts containing "grinch"; never throws
export function checkPrompt(prompt: string): { ok: true } | { ok: false; reason: string };

// fakes/drafts.ts — in-memory
export const drafts: {
  save(cardId: string, text: string): void;
  expire(cardId: string): void;
  deleteOlderThan(age: string): number; // returns count deleted
};

// fakes/warehouse.ts — each call costs one write regardless of row count
export function insertRows(table: string, rows: object[]): Promise<{ inserted: number }>;

// fakes/reactions.ts — Day 12; deterministic per (cardId, variant)
// variant "warm" reacts ~70% of the time, "classic" ~40%
export function simulateReaction(cardId: string, variant: string): boolean;

// chaos.ts
export type ChaosSpec = {
  failTimes: number;     // fail this many calls…
  afterCalls?: number;   // …after letting this many succeed (default 0)
  status?: 429 | 500;
  retryAfterMs?: number;
  retryInMs?: number;    // throw RetryAfterError instead, so retries land ~1 s apart (Phase 3b)
};
export type Chaos = { llm?: ChaosSpec; image?: ChaosSpec; mail?: ChaosSpec };
export const chaosMiddleware: /* v4 middleware */ unknown;

// ledger.ts — every fake call appends one entry
export type LedgerEntry = {
  at: number; provider: "llm" | "image" | "mail" | "warehouse";
  op: string; cardId?: string; ok: boolean; costUsd?: number; meta?: Record<string, unknown>; // llm records { prompt, variant }
};
export function record(entry: LedgerEntry): void;
export function entries(): LedgerEntry[];
export function reset(): void;

// serve.ts
export function startServer(opts: {
  client: Inngest; functions: InngestFunction.Any[]; port?: number; // default process.env.PORT
}): void;
```

**Chaos.** Scenarios put a `Chaos` object in `event.data.chaos`. `chaosMiddleware` runs each function execution inside `AsyncLocalStorage.run()` with that object, and every fake reads it from there, so lesson code never passes it. Child runs started with `step.invoke` or `step.sendEvent` inherit the parent's `cardId` and `chaos` (added in Phase 3). Failure counters are keyed by `${cardId}:${provider}` and fail the first `failTimes` calls. Fetch the [v4 middleware lifecycle docs](https://www.inngest.com/docs-markdown/reference/typescript/v4/middleware/lifecycle) first; if v4 middleware cannot wrap execution this way, stop and ask.

**Server.** `startServer` mounts `serve()` at `/api/inngest` with `express.json({ limit: "1mb" })`, plus two test-only routes: `GET /__ledger` returns `entries()` and `DELETE /__ledger` calls `reset()`. `pnpm check` uses them to assert on side effects.

**Logging.** Every fake logs one line per call in the form `[llm] writeCard c1 billed $0.004 (call #2)`. These lines are on camera, so keep the format exact.

### Ledger wall

A shared, on-camera view of the ledger, so the counts each lesson turns on (bills, 429s, duplicate deliveries, writes) read from across the room instead of from terminal log lines. Approved after Phase 4 as a `@12days/shared` contract change.

```ts
// serve.ts — startServer gains one optional field; index.ts stays a single call
export type WallAction =
  | { kind: "button"; label: string; event: string; data: Record<string, unknown> }
  | { kind: "text"; label: string; event: string; data: Record<string, unknown>; field: string }; // sends on every keystroke

export function startServer(opts: {
  client: Inngest; functions: InngestFunction.Any[]; port?: number;
  wall?: { actions?: WallAction[] };
}): void;
```

- **`GET /`** serves one static `wall.html` from the shared package: inline CSS and JS, no framework, no build step, no new dependencies. It polls `GET /__ledger` every 500 ms.
- **`GET /__wall`** returns `{ appId, title, actions }`. The title is the day's README heading (the app runs from its day folder), and the level comes from the day number.
- **Panels, shown only once a provider has entries:** LLM (calls, dollars billed, call number per card); Image (rendered, 429, failed); Mail (deliveries in arrival order, duplicate recipients highlighted); Warehouse (writes and rows). These are the same numbers the scenario tables assert.
- **Reset** calls `DELETE /__ledger`, so presenters can clear the wall between "break it" and "fix it".
- **`POST /__event`** sends `{ name, data }` through the day's own client, accepting only event names listed in `wall.actions`. Actions render as buttons or text boxes above the panels.
- **Actions, three days only**, where a person is the trigger:
  - Day 04: buttons "Request card c1" → `card/requested` and "Approve c1" → `card/approved { cardId: "c1" }`
  - Day 08: text boxes "Card message" → `card/edited` and "Card message (no debounce)" → `card/edited.before`, each `{ cardId: "c1", prompt }` on every keystroke
  - Day 12: buttons "Love it" / "Meh" per card → `card/reacted`
- **Not lesson code.** No `@lesson` markers, no budget, identical on `starter` and `main`. Scenarios in `send.ts` remain the tests; `pnpm check` asserts `GET /` serves the page and `/__wall` reports the right day (`PASS NN ledger-wall`). Every README's "Watch it" ends with one line on what the wall shows.
- **Design hooks.** Colors and type as CSS custom properties at the top of `wall.html`, including the four level colors from the Notion tech spec, so the designer can theme it without touching JS. Every day shows its level color and title.

## Day folder contract

Every day has the same seven files; only `functions.ts`, `events.ts`, `send.ts` and the README differ in substance. Build Day 1 as the template, then copy its shape.

| File | Contents |
| --- | --- |
| `package.json` | `@12days/day-NN`; deps `inngest@^4.8.0`, `express`, `@12days/shared: workspace:*` |
| `src/client.ts` | `export const inngest = new Inngest({ id: "day-NN", middleware: [chaosMiddleware] })` |
| `src/events.ts` | Only the `eventType()`s this day uses, duplicated per day on purpose |
| `src/functions.ts` | The lesson. Ends with `export const functions = [...]` |
| `src/index.ts` | `startServer({ client: inngest, functions })`, nothing else |
| `send.ts` | `export const scenarios: Record<string, Scenario>` |
| `README.md` | Template below |

**Optional `src/before.ts`.** Days whose “break it” needs different code ship the naive version here. Its functions use ids suffixed `-before` and trigger on the same event name suffixed `.before` (e.g. `card/requested.before`), so both versions run side by side. Starters leave this file untouched.

**Scenario format.** Each scenario is both the demo command and the test. Add `testing.ts` to `@12days/shared` exporting these types.

```ts
export type RunStatus = "Completed" | "Failed" | "Cancelled" | "Running";

export type Scenario = {
  description: string;                       // shown by `pnpm send NN --list`
  env?: Record<string, string>;              // e.g. { DRAFT_TTL: "5s" } for check runs
  send: (ctx: {
    inngest: Inngest;
    sleep: (ms: number) => Promise<void>;
  }) => Promise<string[]>;                   // ids of every event sent
  expect: {
    settleMs: number;                        // deadline; see check.ts step 3
    runs?: { fn: string; status: RunStatus; count?: number; output?: unknown }[]; // output: JSON-equal to every matching run
    ledger?: Record<`${string}.${string}`, number>; // exact call counts, e.g. "llm.writeCard": 1
    deliveredOrder?: string[];               // cardIds, from mail ledger entries
    custom?: (ledger: LedgerEntry[]) => string | null; // null = pass
  };
};
```

**Lesson markers.** Allowed in `functions.ts` and `events.ts` only; never nested.

- `// @lesson:start <TODO text>` opens a region; `// @lesson:end` closes it.
- In the starter, the region becomes `// TODO: <TODO text>` at the same indentation.
- Lines inside a region written as `// @lesson:stub <code>` are uncommented in the starter, so the starter still typechecks and runs (e.g. `// @lesson:stub const card = await writeCard(event.data);`).
- The lesson budget counts non-blank lines inside regions, excluding stubs.

**README template.** Same headings every day; the landing page renders them.

```markdown
# Day NN: <problem as a question or complaint>
## The problem        <!-- two sentences, no feature names -->
## Break it           <!-- pnpm send NN <scenario>, and what you'll see -->
## Fix it             <!-- the primitive + the lesson code -->
## Watch it           <!-- what to look at in the Dev Server run view -->
## In your app        <!-- 2–3 lines on adapting to an existing codebase -->
## Next               <!-- one line teasing tomorrow -->
```

## Tooling: check and starters

`pnpm check` is the definition of done for every day. `pnpm starters` derives the code-along branch from `main`, so the two never drift.

**`scripts/check.ts` \[NN\]**

1. Run `tsc -b` and `biome check` across the workspace. Stop on failure.
2. For each selected day, in order: start the app and a fresh Dev Server (as `day.ts` does) and wait until `GET /api/inngest` responds and the app is synced.
3. For each scenario: `DELETE /__ledger`, run `send`, then assert `expect` against `GET /__ledger` and the Dev Server's runs. If every expected run status is terminal, poll every 2 s and pass as soon as all expectations hold, failing at `settleMs`; if any expects `Running`, wait the full `settleMs` first (Phase 3: retry backoff jitters too much for fixed waits).
4. If a scenario has `env`, restart the app with that env before running it.
5. Enforce the lesson budget: count lines inside `@lesson` regions and fail if over `export const lessonBudget` in the day's `send.ts`.
6. Print one line per scenario (`PASS 01 flaky-image 4.2s`), tear everything down, exit 1 on any failure.

Run lookups go through the Dev Server's REST API, starting from the event ids `send` returns. Runs not tied to a sent event (invoked children, fan-out children, `onFailure`) may need a function-level query. If the Dev Server exposes none, assert those through the ledger and record the gap under Stop and ask.

**`scripts/make-starters.ts`**

- Creates a temporary git worktree at `HEAD`, rewrites every file containing `@lesson` markers per the marker rules, and commits to `starter` with message `starter: <main sha>`.
- Runs `tsc -b` inside the worktree. A starter that doesn't typecheck fails the script, which usually means a missing `@lesson:stub`.
- Pushes only with `--push` (CI on `main`). Never touches the main working tree. Idempotent: no diff, no commit.

**CI.** `.github/workflows/ci.yml` runs `pnpm install --frozen-lockfile`, `pnpm check`, then `pnpm starters --push` on `main`. Renovate (or Dependabot) watches `inngest` so minor releases run through `pnpm check` before merging.

## Days 1–3: make it work

Level 1 JTBD: “I am building something that needs to survive failure.” Day 1 is also the template every other day copies.

### Day 01 — `01-survive-failure` (budget 15)

Problem: the image API fails and the whole request dies, including the LLM call you already paid for.

| Scenario | Sends | Expect |
| --- | --- | --- |
| `happy` | `card/requested` c1 | `create-card` Completed; `llm.writeCard` 1, `image.renderImage` 1, `mail.sendCard` 1 |
| `flaky-image` | c1 with `chaos.image.failTimes: 2` | Completed; **`llm.writeCard` 1**, `image.renderImage` 3, `mail.sendCard` 1 |
| `flaky-image-before` | same, to `card/requested.before` | `create-card-before` Completed; **`llm.writeCard` 3** (the double-billing shot) |

`before.ts`: the same three calls in the handler body with no steps.

```ts
// events.ts
import { eventType, staticSchema } from "inngest";
export type CardRequest = { cardId: string; prompt: string; to: string };
export const cardRequested = eventType("card/requested", {
  schema: staticSchema<CardRequest>(),
});

// functions.ts
export const createCard = inngest.createFunction(
  { id: "create-card", triggers: [cardRequested] },
  async ({ event, step }) => {
    // @lesson:start Wrap each provider call in its own step
    const card = await step.run("write-text", () => writeCard(event.data));
    const image = await step.run("render-image", () => renderImage({ text: card.text }));
    await step.run("deliver", () => sendCard({ to: event.data.to, cardId: event.data.cardId }));
    // @lesson:stub const card = await writeCard(event.data);
    // @lesson:stub const image = await renderImage({ text: card.text });
    // @lesson:end
    return { text: card.text, image: image.url };
  }
);

export const functions = [createCard];
```

README note: include a short “loop vs step” callout (one step per side effect, never one step around a whole loop). No code change.

### Day 02 — `02-fail-fast` (budget 25)

Problem: some failures can never succeed and retrying them wastes time and money; others tell you exactly when to come back.

| Scenario | Sends | Expect |
| --- | --- | --- |
| `happy` | c1 | `create-card` Completed |
| `grinch` | c1 with prompt containing “grinch” | `create-card` Failed within 15 s; `mail.notifySender` 1; `llm.writeCard` 0 |
| `grinch-before` | same, to `.before` | after 15 s `create-card-before` still Running (retrying); `mail.notifySender` 0 |
| `llm-429` | c1 with `chaos.llm: { failTimes: 1, status: 429, retryAfterMs: 5000 }` | Completed; `llm.writeCard` 2; custom: second call 4–10 s after first (retries are scheduled to the second; default backoff would be ≥ 15 s) |

`before.ts`: Day 1's function plus the moderation check throwing a plain `Error`.

```ts
export const createCard = inngest.createFunction(
  {
    id: "create-card",
    triggers: [cardRequested],
    // @lesson:start Tell the sender when a card fails for good
    onFailure: async ({ event, error, step }) => {
      await step.run("notify-sender", () =>
        notifySender(event.data.event.data.cardId, error.message)
      );
    },
    // @lesson:end
  },
  async ({ event, step }) => {
    await step.run("moderate", () => {
      const verdict = checkPrompt(event.data.prompt);
      // @lesson:start Stop retrying when moderation says no
      if (!verdict.ok) throw new NonRetriableError(`Rejected: ${verdict.reason}`);
      // @lesson:end
    });
    const card = await step.run("write-text", async () => {
      try {
        return await writeCard(event.data);
      } catch (err) {
        // @lesson:start Retry exactly when the provider says to
        if (err instanceof ProviderError && err.status === 429) {
          throw new RetryAfterError("LLM rate limited", err.retryAfterMs!, { cause: err });
        }
        // @lesson:end
        throw err;
      }
    });
    // render-image + deliver as Day 01
  }
);
```

Verify: the `onFailure` event shape (`event.data.event`) and `RetryAfterError`'s third argument against the errors doc.

### Day 03 — `03-split-the-work` (budget 15)

Problem: one function owns text, image and delivery, so the flakiest dependency sets the retry policy for everything.

| Scenario | Sends | Expect |
| --- | --- | --- |
| `happy` | c1 | `create-card` and `render-card-image` Completed |
| `very-flaky-image` | c1 with `chaos.image.failTimes: 5` | both Completed; `image.renderImage` 6; `llm.writeCard` 1 |
| `very-flaky-image-before` | same, to `.before` | `create-card-before` Failed (4 retries exhausted); `mail.sendCard` 0 |

```ts
// @lesson:start Give rendering its own function and retry policy
export const renderCardImage = inngest.createFunction(
  { id: "render-card-image", retries: 10 }, // no trigger: invoke-only
  async ({ event, step }) =>
    step.run("render", () => renderImage({ text: event.data.text }))
);
// @lesson:end

export const createCard = inngest.createFunction(
  { id: "create-card", triggers: [cardRequested] },
  async ({ event, step }) => {
    const card = await step.run("write-text", () => writeCard(event.data));
    // @lesson:start Invoke it and wait for the result
    const image = await step.invoke("render-image", {
      function: renderCardImage,
      data: { text: card.text },
    });
    // @lesson:stub const image = await step.run("render-image", () => renderImage({ text: card.text }));
    // @lesson:end
    await step.run("deliver", () => sendCard({ to: event.data.to, cardId: event.data.cardId }));
  }
);

export const functions = [createCard, renderCardImage];
```

Verify: how v4 types `event.data` for an invoke-only function (the `invoke()` trigger helper may be required for typing).

## Days 4–6: make it scale

Level 2 JTBD: “I've added more complex workflows tuned to my users.” Waits in this level are short in scenarios (seconds), with production-length defaults in code.

### Day 04 — `04-wait-for-a-human` (budget 15)

Problem: the sender should approve the draft before it goes out, without a polling loop or a state machine.

| Scenario | Env | Sends | Expect |
| --- | --- | --- | --- |
| `approve` | `DRAFT_TTL=30s` | c1, then `card/approved` c1 after 6 s (text + image take up to ~4 s; earlier approvals are missed) | `create-card` Completed; `mail.sendCard` 1 |
| `ignore` | `DRAFT_TTL=5s` | c1 only | Completed with output `{ status: "expired" }` within 15 s; `mail.sendCard` 0 |
| `approve-wrong-card` | `DRAFT_TTL=30s` | c1, then `card/approved` c2 | after 10 s still Running; `mail.sendCard` 0 |

```ts
export const cardApproved = eventType("card/approved", {
  schema: staticSchema<{ cardId: string }>(),
});

// inside createCard, after write-text and render-image:
await step.run("save-draft", () => drafts.save(event.data.cardId, card.text));
// @lesson:start Pause until the sender approves, or give up
const approval = await step.waitForEvent("wait-for-approval", {
  event: cardApproved,
  match: "data.cardId",
  timeout: process.env.DRAFT_TTL ?? "48h",
});
if (approval === null) {
  await step.run("expire-draft", () => drafts.expire(event.data.cardId));
  return { status: "expired" };
}
// @lesson:end
await step.run("deliver", () => sendCard({ to: event.data.to, cardId: event.data.cardId }));
return { status: "delivered" };
```

Verify: that `match` is accepted alongside an `eventType` object in v4 `waitForEvent`.

### Day 05 — `05-deliver-on-the-25th` (budget 25)

Problem: cards go out on a specific date, abandoned drafts pile up, and a deleted card must never be delivered.

| Scenario | Sends | Expect |
| --- | --- | --- |
| `scheduled` | `card/approved` c1 with `deliverAt` = now + 5 s | `schedule-delivery` Completed; `mail.sendCard` 1; custom: delivery ≥ 4 s after send (1 s slack: sleeps are scheduled to the second) |
| `delete-before-delivery` | c1 with `deliverAt` = now + 10 s; `card/deleted` c1 after 2 s | `schedule-delivery` Cancelled; `mail.sendCard` 0 |
| `delete-before-delivery-before` | same, to `.before` (no `cancelOn`) | `schedule-delivery-before` Completed; `mail.sendCard` 1 (the bug) |
| `cleanup` | `drafts/cleanup.requested` | `cleanup-drafts` Completed |

```ts
export type ApprovedCard = { cardId: string; to: string; deliverAt: string }; // ISO 8601

export const scheduleDelivery = inngest.createFunction(
  {
    id: "schedule-delivery",
    triggers: [cardApproved],
    // @lesson:start Cancel the sleeping run when the card is deleted
    cancelOn: [{ event: "card/deleted", match: "data.cardId" }],
    // @lesson:end
  },
  async ({ event, step }) => {
    // @lesson:start Sleep until the delivery date
    await step.sleepUntil("wait-for-delivery-date", event.data.deliverAt);
    // @lesson:end
    await step.run("deliver", () => sendCard({ to: event.data.to, cardId: event.data.cardId }));
  }
);

// @lesson:start Clean up abandoned drafts nightly, or on demand
export const cleanupDrafts = inngest.createFunction(
  {
    id: "cleanup-drafts",
    triggers: [{ cron: "TZ=America/New_York 0 3 * * *" }, { event: "drafts/cleanup.requested" }],
  },
  async ({ step }) => step.run("delete-stale", () => drafts.deleteOlderThan("7d"))
);
// @lesson:end
```

The second trigger exists so `pnpm check` and the video can run cleanup without waiting for 3am. It also shows v4's trigger arrays.

### Day 06 — `06-one-user-per-lane` (budget 5)

Problem: one account sends a burst of cards and everyone else's single card waits behind them.

| Scenario | Env | Sends | Expect |
| --- | --- | --- | --- |
| `noisy-neighbor` | `IMAGE_RATE=off` | 20 cards from account `a`, then `b1` from account `b` 2 s later | all Completed within 60 s; custom: `b1` among the first 6 deliveries |
| `noisy-neighbor-before` | `IMAGE_RATE=off` | same, to `.before` (no key) | custom: `b1` delivered 13th or later (measured: 19th of 21) |

`CardRequest` gains `accountId: string` from this day on. `IMAGE_RATE=off` keeps the image fake's rate limit out of the way until Day 7.

```ts
export const createCard = inngest.createFunction(
  {
    id: "create-card",
    triggers: [cardRequested],
    concurrency: [
      { limit: 5 }, // total capacity
      // @lesson:start Give each account its own lane
      { key: "event.data.accountId", limit: 2 },
      // @lesson:end
    ],
  },
  async ({ event, step }) => { /* Day 01 body */ }
);
```

## Days 7–9: make it faster

Level 3 JTBD: “I'm getting crushed by usage and it's starting to hurt users.” Checkpointing, the fourth Level 3 lever, is on by default in v4, so it gets a README mention rather than a day.

### Day 07 — `07-respect-rate-limits` (budget 5)

Problem: the image provider allows 5 calls per 10 seconds; a burst of cards turns into a wall of 429s and wasted retries.

| Scenario | Sends | Expect |
| --- | --- | --- |
| `burst` | 15 cards at once | all Completed within 60 s; `image.renderImage` 15 calls, 0 failures |
| `burst-before` | same, to `.before` (no throttle) | all Completed eventually; custom: ≥ 1 image call failed with 429 |

Throttle goes on Day 03's `render-card-image` child, so one run start equals one image call. Throttling limits run starts, not steps, which is the contrast with Day 06 the README must spell out.

```ts
export const renderCardImage = inngest.createFunction(
  {
    id: "render-card-image",
    retries: 10,
    // @lesson:start Start at most 5 renders per 10 seconds
    throttle: { limit: 5, period: "10s" },
    // @lesson:end
  },
  async ({ event, step }) =>
    step.run("render", () => renderImage({ text: event.data.text }))
);
```

### Day 08 — `08-wait-for-quiet` (budget 5)

Problem: the live preview regenerates on every edit, so a user typing a message bills eight LLM calls for one card.

| Scenario | Sends | Expect |
| --- | --- | --- |
| `typing-burst` | 8 `card/edited` c1 events, 300 ms apart | `regenerate-preview` Completed, count 1; `llm.writeCard` 1; custom: that call used the last prompt |
| `typing-burst-before` | same, to `.before` | `regenerate-preview-before` count 8; `llm.writeCard` 8 |
| `two-cards` | interleaved bursts for c1 and c2 | count 2; `llm.writeCard` 2 |

```ts
export const cardEdited = eventType("card/edited", {
  schema: staticSchema<{ cardId: string; prompt: string }>(),
});

export const regeneratePreview = inngest.createFunction(
  {
    id: "regenerate-preview",
    triggers: [cardEdited],
    // @lesson:start Wait for 3 quiet seconds per card, then use the latest edit
    debounce: { key: "event.data.cardId", period: "3s" },
    // @lesson:end
  },
  async ({ event, step }) =>
    step.run("write-preview", () => writeCard({ prompt: event.data.prompt }))
);
```

### Day 09 — `09-send-to-everyone` (budget 20)

Problem: sending one card to 50 recipients in a single loop means one failure re-sends to everyone who already got it.

| Scenario | Sends | Expect |
| --- | --- | --- |
| `bulk-50` | one `card/bulk-send` with 50 recipients; `chaos.mail: { afterCalls: 24, failTimes: 1 }` | `bulk-send` Completed; `deliver-card` Completed, count 50; `mail.sendCard` 51 calls, 0 duplicate recipients |
| `bulk-50-before` | same, to `.before` (loop inside one step) | custom: ≥ 20 recipients delivered twice |

`before.ts` is the loop-vs-step anti-pattern from the customer call: one `step.run` wrapping the whole `for` loop. The README should name it as such.

```ts
export const cardDeliver = eventType("card/deliver", {
  schema: staticSchema<{ cardId: string; to: string }>(),
});

export const bulkSend = inngest.createFunction(
  { id: "bulk-send", triggers: [cardBulkSend] },
  async ({ event, step }) => {
    // @lesson:start Fan out: one event per recipient
    await step.sendEvent(
      "fan-out",
      event.data.recipients.map((to) => cardDeliver.create({ cardId: event.data.cardId, to }))
    );
    // @lesson:end
    return { queued: event.data.recipients.length };
  }
);

// @lesson:start Each delivery is its own run with its own retries
export const deliverCard = inngest.createFunction(
  { id: "deliver-card", triggers: [cardDeliver] },
  async ({ event, step }) =>
    step.run("deliver", () => sendCard({ to: event.data.to, cardId: event.data.cardId }))
);
// @lesson:end
```

README: when the parent needs the children's results, the same move uses `step.invoke` per recipient in `Promise.all` (callback to Day 03). Verify that `step.sendEvent` accepts `eventType.create()` payloads.

## Days 10–12: make it profitable

Level 4 JTBD: “I need to segment service by what users pay and protect my margins.” These are the features most likely to be gated by plan; see Stop and ask before publishing.

### Day 10 — `10-paid-users-first` (budget 5)

Problem: when the queue backs up, paying customers wait behind free-tier traffic.

| Scenario | Env | Sends | Expect |
| --- | --- | --- | --- |
| `pro-arrives-late` | `IMAGE_RATE=off` | 20 free cards, then 2 pro cards (`p1`, `p2`) | all Completed; custom: `p1` and `p2` among the first 6 deliveries |
| `pro-arrives-late-before` | `IMAGE_RATE=off` | same, to `.before` | custom: `p1` and `p2` among the last 4 deliveries |

`CardRequest` gains `plan: "free" | "pro"`. The function keeps `concurrency: { limit: 2 }` so a queue actually forms.

```ts
export const createCard = inngest.createFunction(
  {
    id: "create-card",
    triggers: [cardRequested],
    concurrency: { limit: 2 },
    // @lesson:start Pro cards jump up to 2 minutes ahead in the queue
    priority: { run: "event.data.plan == 'pro' ? 120 : 0" },
    // @lesson:end
  },
  async ({ event, step }) => { /* Day 01 body */ }
);
```

Key queues are explainer-only here: key-queue scheduling currently requires Enterprise access ([flow control docs](https://www.inngest.com/docs/durable-execution/flow-control.md)), so it can't run in the Dev Server demo. The README links the priority vs key queues explainer video.

### Day 11 — `11-batch-the-boring-stuff` (budget 10)

Problem: every “card opened” event does its own warehouse insert, and you pay per write.

| Scenario | Sends | Expect |
| --- | --- | --- |
| `opens-120` | 120 `card/opened` events over 2 s | `record-opens` Completed, count ≤ 4; `warehouse.insertRows` ≤ 4 calls; custom: rows inserted total 120 |
| `opens-120-before` | same, to `.before` | `warehouse.insertRows` 120 calls |

```ts
export const cardOpened = eventType("card/opened", {
  schema: staticSchema<{ cardId: string; openedAt: string }>(),
});

export const recordOpens = inngest.createFunction(
  {
    id: "record-opens",
    triggers: [cardOpened],
    // @lesson:start Collect up to 50 opens, or whatever arrives in 5 s
    batchEvents: { maxSize: 50, timeout: "5s" },
    // @lesson:end
  },
  // @lesson:start Handle the whole batch at once
  async ({ events, step }) =>
    step.run("insert-opens", () => insertRows("card_opens", events.map((e) => e.data)))
  // @lesson:end
);
```

README: batching can't be combined with priority, cancellation events, rate limiting, idempotency or debounce on the same function ([batching docs](https://www.inngest.com/docs/durable-execution/flow-control/batching.md)). The warehouse fake records `meta.rows` so the check can count rows.

### Day 12 — `12-measure-what-works` (budget 35)

Problem: you changed the card prompt and have no idea whether recipients like it more.

| Scenario | Env | Sends | Expect |
| --- | --- | --- | --- |
| `experiment-40` | `REACTION_TTL=60s` | 40 cards; once the ledger shows 40 `writeCard` calls, one `card/reacted` per card with `loved = simulateReaction(cardId, variant)` | `create-card` Completed, count 40; `score-recipient-reaction` Completed, count 40; custom: each variant served ≥ 10 times |

No `before.ts`: the “before” is shipping a prompt change blind, told in the README. Requires `inngest@^4.8.0`; scoring and deferred scoring are beta APIs ([Agent Evals quick start](https://www.inngest.com/docs/agent-evals/quick-start.md)).

```ts
// client.ts
export const inngest = new Inngest({
  id: "day-12",
  middleware: [chaosMiddleware, scoreMiddleware()], // scoreMiddleware from "inngest/experimental"
});

// functions.ts
// @lesson:start A scorer that waits for the recipient's reaction
export const reactionScorer = createScorer(
  inngest,
  { id: "score-recipient-reaction", schema: z.object({ cardId: z.string() }) },
  async ({ event, step }) => {
    const reaction = await step.waitForEvent("wait-for-reaction", {
      event: "card/reacted",
      timeout: process.env.REACTION_TTL ?? "7d",
      if: `async.data.cardId == '${event.data.cardId}'`,
    });
    if (!reaction) return null;
    return { name: "recipient-loved-it", value: reaction.data.loved };
  }
);
// @lesson:end

export const createCard = inngest.createFunction(
  { id: "create-card", triggers: [cardRequested] },
  async ({ event, step, group, defer }) => {
    // @lesson:start Split traffic between two prompt variants
    const { result: card, variant, experimentRef } = await group.experiment("card-tone", {
      variants: {
        classic: () => step.run("write-classic", () => writeCard({ ...event.data, variant: "classic" })),
        warm: () => step.run("write-warm", () => writeCard({ ...event.data, variant: "warm" })),
      },
      select: experiment.weighted({ classic: 50, warm: 50 }),
    });
    // @lesson:stub const card = await step.run("write-text", () => writeCard(event.data));
    // @lesson:end
    // @lesson:start Score now what you know now; defer what you learn later
    await step.score("score-length", { name: "fits-on-card", value: card.text.length <= 280 });
    defer("score-reaction", {
      function: reactionScorer,
      data: { cardId: event.data.cardId },
      experiment: experimentRef,
    });
    // @lesson:end
    await step.run("deliver", () => sendCard({ to: event.data.to, cardId: event.data.cardId }));
    return { variant };
  }
);

export const functions = [createCard, reactionScorer];
```

Verify: the full `group.experiment()`, `defer()` and `createScorer()` signatures against the [Agent Evals reference](https://www.inngest.com/docs/agent-evals/reference.md). The starter's stub leaves `variant` undefined; fix with a second stub line if the return breaks typecheck.

## Build order

Six phases, one Claude Code session each. A phase is done only when its gate command passes; report failures instead of working around them.

**Phase 0: scaffold.** Gate: `pnpm install && pnpm lint && pnpm exec tsc -b`

- [ ] Root `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `biome.json`, `.gitignore`
- [ ] Commit `CLAUDE.md` and `SPEC.md`; install inngest-skills into `.claude/skills/`
- [ ] Empty `packages/shared` and `finale` packages that compile

**Phase 1: shared, runner, Day 01.** Gate: `pnpm check 01`

- [ ] `@12days/shared` per the contract, including `testing.ts` and `chaosMiddleware`
- [ ] `scripts/day.ts`, `scripts/send.ts`, `scripts/check.ts`
- [ ] Day 01 complete, including `before.ts` and README
- [ ] Measure the Dev Server's default retry backoff for 2, 4 and 6 failures; write the numbers into the Stop and ask section

**Phase 2: starters and CI.** Gate: `pnpm starters && pnpm check 01`

- [ ] `scripts/make-starters.ts` per the marker rules; starter branch typechecks
- [ ] `.github/workflows/ci.yml` and Renovate config for `inngest`

**Phase 3: Days 02–06.** Gate: `pnpm check 02 03 04 05 06`

- [ ] One day at a time, each fully passing before the next starts
- [ ] Fetch the docs URLs for each day's primitive first; log any mismatch with this spec

**Phase 3b: snappy rework.** Gate: `pnpm check 01 03`, each README scenario visibly done in < 60 s

- [x] Rework Day 01 and Day 03 scenarios to meet the "On camera" rule (see "Snappy scenarios" under Stop and ask); propose the approach before changing lesson code
- [x] Re-run the full Phase 3 gate (`pnpm check 01 02 03 04 05 06`); its last run was interrupted by a reboot

**Phase 4: Days 07–11.** Gate: `pnpm check 07 08 09 10 11`

- [x] Same rules as Phase 3
- [x] Starter fix: Days 03, 05 and 09 wrap `export const functions` in a lesson region with a stub, so the starter typechecks when a whole function is the lesson

**Phase 4b: ledger wall.** Gate: `pnpm check` (all days), including each day's `ledger-wall` line

- [x] `wall.html`, `GET /`, `GET /__wall`, `POST /__event` and the `wall` option per "Ledger wall" above
- [x] Actions for Days 04 and 08 (Day 12's land with Phase 5); one "Watch it" line per README

**Phase 5: Day 12 and final pass.** Gate: `pnpm check` (all days) and `pnpm starters` (passed: 55/55 checks, starter typechecks)

- [x] Day 12 on `inngest@^4.8.0` with `scoreMiddleware` (`pnpm check 12` passes in ~6 s; see "Day 12 surface")
- [x] Re-read every README against the template; every “Break it” command must match a scenario name (all 12 pass: title, six headings, two-sentence problem with no feature names, every `pnpm send` names a real scenario)
- [x] Print a table of lesson-line counts versus budgets for human review

  | Day | Lines / budget | Day | Lines / budget | Day | Lines / budget |
  | --- | --- | --- | --- | --- | --- |
  | 01 | 3 / 15 | 05 | 10 / 25 | 09 | 10 / 20 |
  | 02 | 9 / 25 | 06 | 1 / 5 | 10 | 1 / 5 |
  | 03 | 9 / 15 | 07 | 1 / 5 | 11 | 8 / 10 |
  | 04 | 9 / 15 | 08 | 1 / 5 | 12 | 32 / 35 |

## Stop and ask

Claude Code leaves `// TODO(human): …` and moves on for anything below; none of these are its call. Open items are listed first.

**Open decisions**

- [x] **Retry backoff timing.** Phase 1 records how long the Dev Server takes to exhaust 2, 4 and 6 failures. If the `-before` scenarios take over 2 minutes, decide between lowering `retries` in `before.ts` and accepting a slower check. Measured values (Phase 1, Dev Server 1.49.0, default `retries: 4`, retry gaps ~25–30 s, ~45 s, ~75–85 s, ~150 s with jitter): **2 failures → Completed after ~80–105 s; 4 failures → Completed after ~305 s; 6 failures → Failed (retries exhausted) after ~295 s.** Day 01's two-failure scenarios fit in a 120 s `settleMs`; Day 03's `very-flaky-image-before` (4 retries exhausted) needs ~5 min. Phase 3 (Day 03, step-level failures): image attempts at ~4, 39, 93, 167, 309 s after send; the sixth succeeds at ~611 s and the default-retries run fails at ~324 s. Decision: Day 03 uses `failTimes: 5` (settle 720 s / 420 s) instead of 6 (~20+ min). Superseded in Phase 3b by `retryInMs` (see Snappy scenarios).
- [ ] **Run lookups.** If the Dev Server has no function-level runs query, decide whether ledger-only assertions are enough for invoked, fan-out and `onFailure` runs.
- [x] **Day 12 surface.** Answered in Phase 5 (Dev Server 1.49): its Experiments and Scores pages say "The Dev Server doesn't display experiments/scores yet" and point to Inngest Cloud, so the comparison needs Cloud and a signing key in the demo flow. Two beta quirks to report upstream: once a deferred score lands, the Dev Server reports the parent run as Running and its run view is empty (the run did finish); and the TS SDK's `ScoreStepTool` type isn't exported, so a declaration-emitting (composite) project can't build a client with `scoreMiddleware()` (TS2883). Day 12 typechecks with `--noEmit` outside `tsc -b` (`NO_EMIT_PROJECTS` in `scripts/lib.ts`), and its scenario checks `create-card` through the ledger. **Decided: record Day 12 against Cloud** via `--cloud` (Inngest Connect, verified end to end against the Dev Server's Connect gateway; not yet against Cloud itself, which needs the shoot's keys).
- [ ] **Plan gating.** Priority, batching (`maxSize: 50` versus plan batch limits) and Agent Evals need a check against the pricing and packaging decision before Days 10–12 publish.
- [ ] **Contest template.** Days run locally on Express; contest entries need a live deploy link. Decide whether a separate Vercel-ready template is in scope.
- [ ] **Ledger wall redesign (after Phase 5).** The first version reads as generic service panels. Revisit once all 12 days exist, choosing between three mocked directions: (A) before and after columns that both stay on screen, with Break it / Fix it buttons that run the scenarios; (B) one hero number per day as a plain-language outcome, with the "before" as a struck-out ghost; (C) a timeline of calls per run for timing-driven days (07, 08, 10). Each day will need a small wall config naming its hero metric.
- [x] **Ledger wall (added after Phase 4).** Approved and built in Phase 4b. Still open: whether presenters show it beside the Dev Server, and whether the designer themes it (tokens at the top of `wall.html`) before the shoot.
- [ ] **Finale.** `finale/` stays an empty scaffold until the livestream build is specced.
- [x] **Throttle vs. the image fake (added Phase 4).** Day 07 `burst` got four 429s: the Dev Server's throttle starts a small burst, then one run every 2 s, while the image fake counted any 10 s sliding window. **Resolved:** the fake is now a token bucket (5 tokens, one back every 2 s), which is how Inngest's throttle and many real providers count. Lesson code unchanged; `burst` passes in ~24 s with zero 429s.
- [ ] **Day 07 `burst-before` timing.** The 429 wall shows within seconds, so the scenario asserts only that (settle 15 s). Its retries use real backoff and finish minutes later; the check cancels them. Confirm that's acceptable on camera, or have the fake's 429 carry `retryInMs`.
- [x] **Snappy scenarios (added Phase 3).** The "On camera" rule wants every README scenario visibly done in under 60 s. Built days that break it today (measured): Day 01 `flaky-image` and `flaky-image-before` ~80–105 s (two default-backoff retries); Day 03 `very-flaky-image` ~10 min and `very-flaky-image-before` ~5.5 min (five failures). The Dev Server's retry backoff (~35 s, 55 s, 75 s, 140 s, 300 s gaps) is the bottleneck and isn't configurable from the SDK, so fixing these means fewer failures, a chaos status that maps to `RetryAfterError`, or cutting the shot in editing. Day 06 (~60 s for 21 cards) is borderline. **Resolved (Phase 3b):** `ChaosSpec.retryInMs` makes chaos failures throw `RetryAfterError`, so the Dev Server retries after ~1 s. Lesson code and failure counts are unchanged. Measured: Day 01 `flaky-image`/`-before` 10 s; Day 03 `very-flaky-image` 20 s, `-before` 16 s. READMEs note that real backoff takes minutes. Day 06 `noisy-neighbor` measured 37 s in the full gate, so it no longer counts as borderline.

**Always stop for**

- Any change to the `@12days/shared` contract or the `Scenario` type
- A day that can't meet its lesson budget
- A dependency not on the allowed list
- A docs page that contradicts this spec in a way that changes what a day teaches (pure syntax drift: fix it and log it)

## Production notes (not part of the build)

For the humans planning the shoot. Claude Code ignores this section.

| Days | Level | Suggested engineer | Note |
| --- | --- | --- | --- |
| 01–03 | Make it work | Jacob | Most onboarding reuse; strongest explainer on the openers |
| 04–05 | Make it scale | Bruno or Tony |  |
| 06–08 | Scale / faster | Scott | Concurrency, throttle, debounce told as one flow-control thread |
| 09–12 | Faster / profitable | Bruno or Tony | Whoever is closest to evals takes 12 |

- **Episode shape:** 60–90 s iPad architecture cold open, then the engineer talks Jason through the `starter` branch in picture-in-picture, ending on the `main` version of that day's folder.
- **The “break it” shot** is a `-before` scenario in every day except 04 and 12. Run it on camera first.
- **Short waits** come from scenario env (`DRAFT_TTL=5s`, `REACTION_TTL=60s`), so nothing on camera waits more than a minute. This is now a build rule ("On camera" in `CLAUDE.md`), not just a production note.
