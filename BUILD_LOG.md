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

## Phase 2: starters and CI

- The idea: viewers code along on a `starter` branch that's generated from `main`, never hand-edited, so the "before" and "after" can't drift apart. Every lesson region in `main` turns into a one-line `// TODO:` in the starter.
- Stubs are what make that work. A region can carry a commented-out "naive" version (`// @lesson:stub ...`) that gets uncommented in the starter. Day 01's starter calls the LLM and image API directly with no steps, which is exactly the code the episode fixes.
- The starter has to typecheck, so the script proves it: it builds the starter in a throwaway git worktree and runs `tsc -b` there. A starter that doesn't compile fails the script, and that almost always means a missing stub.
- One parser now does two jobs. The marker rules that count lesson lines against each day's budget also rewrite the starter, so the budget and the starter can't disagree about what counts as "the lesson."
- A small trap we avoided: the spec, `CLAUDE.md` and the check script all *mention* `@lesson` in their text. A naive "rewrite every file containing the marker" would have mangled them, so the rewrite only touches each day's `functions.ts` and `events.ts`, the two files where markers are allowed.
- The script commits with git plumbing (`write-tree`, `commit-tree`, `update-ref`), so it never checks out a branch or touches your working tree. Running it twice in a row makes no second commit.
- CI runs the full check on every push and PR, then refreshes the starter branch on `main`. Renovate watches only `inngest`, so each SDK release has to get through every day's scenarios before anyone merges it.
- One subtlety: the starter is built from the last commit, not from uncommitted work. That's deliberate. The starter always matches something you can point to in `main`'s history.

## Phase 3: Days 02–06

- Five days in one session: fail fast, split the work, wait for a human, deliver on a date, and one lane per account. Each one was built, checked and documented before the next started. The v4 docs were thin on exact signatures, so the installed SDK's type definitions became the tiebreaker. They agreed with the spec almost everywhere.
- The biggest surprise was in the plumbing, not the lessons. Chaos rides in `event.data`, so an invoked child run (Day 03) only got `{ text }` and never failed on cue. We taught the shared middleware to pass the parent's `cardId` and chaos into `step.invoke` and `step.sendEvent` children. Lesson code didn't change, and Day 09's fan-out gets the fix for free.
- Getting that hook right took one debug log: an invoke step's input isn't `{ data }` but `{ function_id, payload: { data } }`. One line of `console.log` beat ten minutes of guessing.
- Time is the hard part of testing durable code. Retries are scheduled to the whole second, so "the second call came ≥ 5 s later" measured 4.92 s. We now check a window that still rules out the default backoff.
- Day 03 forced a real trade-off. Six image failures need about 20 minutes of exponential backoff before the seventh try succeeds. We measured every retry (35 s, 55 s, 75 s, 140 s, 300 s gaps) and chose five failures: still enough to exhaust the default retries in the "before", and done in about 10 minutes in the "after".
- Then the measurements disagreed with each other. The same Day 03 scenario passed at 720 s on one run and was still waiting at 722 s on the next: backoff jitter is large. Fixed waits were a losing game, so the check now polls. Scenarios that expect finished runs pass the moment everything holds, and `settleMs` becomes a deadline. Scenarios that assert "still running" (the stuck Grinch, the wrong-card approval) still wait the full time, because finishing early would prove nothing.
- Day 04 nearly shipped a race. The approval was sent 3 s after the card, but writing text and rendering an image can take 4 s, and `waitForEvent` only sees events that arrive after it starts waiting. A demo that works on a fast run and silently hangs on a slow one is the worst kind, so the approval now waits until the draft is ready.
- With checkpointing on, a run's output comes back from the Dev Server as a list of checkpoint ops rather than the plain return value, so the check unwraps the `RunComplete` op before comparing.
- Day 06 was flaky until we copied real life. When 20 cards from one account and one from another land in the same millisecond, the scheduler sometimes delivered the lone card first, which wrecks the "noisy neighbor" story. Sending it two seconds after the burst, when a queue has actually formed, made the result steady: 3rd with a per-account key, 19th of 21 without.

## Phase 3b: snappy rework

- New rule for the shoot: every scenario a viewer runs must visibly finish in under a minute. Days 01 and 03 broke it badly, at about 90 seconds and up to 10 minutes, and all of that time was spent waiting on retries.
- The Dev Server's exponential backoff (35 s, then 55 s, 75 s, 140 s, 300 s) is the right default in production and a disaster on camera, and nothing in the SDK changes it.
- We weighed three options: fewer failures (Day 01 would bill the LLM twice instead of three times, and Day 03's "retries run out" story would fall apart), cutting the wait in editing, or bending time.
- We bent time, using the tool Day 02 teaches. Chaos gained one opt-in knob, `retryInMs`. With it set, the fake service throws Inngest's `RetryAfterError` instead of a plain error, so every retry lands about a second later.
- The lessons don't change at all. Day 01 still bills the LLM three times without steps, and Day 03 still exhausts four retries in the "before" and succeeds on the sixth try in the "after". The only difference is the clock: 10 s, 10 s, 20 s and 16 s.
- There's an honesty cost: viewers see retries that are unrealistically fast. Each README owns that in one line, saying the fake asks for quick retries and normal backoff spreads them over minutes.
- The knob is separate from Day 02's 429 scenario on purpose. There, the lesson code turns a provider's retry-after hint into `RetryAfterError`. If the fake did it for you, Day 02 would have nothing left to teach.

## Phase 4: Days 07–12 and the design system

- The rest of the series landed in one pass: throttling, debounce, fan-out, priority, batching and the Day 12 experiment, plus a Cut B of Day 12 that renders agent-written cards in a sandbox. Each day was written by its own helper, and one coordinator ran every check, one at a time, because there is only one Dev Server port.
- The best surprise was a throttle that let one extra call through. Inngest starts one run at the very front of a window, so a limit of 4 per 5 seconds sent five calls into the fake image API's window of five, and the sixth came right after. The 429s repeated identically on every run, so it was not jitter. A limit of 3 per 3 seconds against a provider rate of 5 per 3 stays clean. The README says plainly that this is a faster, safer version of "just under the limit".
- Day 07's "before" needed quick retries on a real rate limit, not on an injected failure. We extended the Phase 3b trick: when a scenario asks for quick retries, the image fake's 429 becomes a retry-after that waits for the real free slot. Lesson code is untouched, and Day 02's own 429 scenario still has its whole lesson.
- Day 12 would not fit in the project references. The scoring middleware leaks an SDK-internal type that TypeScript can't write into a declaration file. Rather than hide it with a cast, Days 12 and 12b are typechecked on their own with `--noEmit`, and adding another day like that is one line.
- Sandboxes are Cloud-only. We tried the local Dev Server first: the sandbox step fails in about a second and asks you to log in. So Day 12b's render scenario only runs when you set a Cloud flag, and the default check skips it with a visible message. The README labels the whole feature as an open beta.
- A new fake, `writeCardCode`, gives the designer agent something to write. It's seeded, so about a quarter of the cards come out as broken code, and the "renders" score visibly varies.
- Running every starter exposed two old bugs. Days 03 and 05 would have shipped starters that didn't compile, because stripping the lesson removed a function the file still exported. Both got stub placeholders. The Dev Server also kept listing a finished Day 12 card as running, so the check now confirms any "running" run with a single-run query.
- Day 10 stays at twenty free cards, even though twenty-two cards at two at a time takes about 33 seconds. It's under a minute, and the story of twenty free cards stuck behind each other is the whole lesson.
- The design system is deliberately quiet: cream paper, evergreen, a muted cranberry and a little brass, big type, flat cards and no pills. Status shows as a dot and a plain colored word. It's two CSS files and no dependencies.
