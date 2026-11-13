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

## Phase 4: Days 07–11

- Five flow-control days: throttle, debounce, fan-out, priority and batching. Four of them came together on the first run. Debounce, fan-out and batching especially are a single option in the function config, and the ledger proves the savings: eight LLM bills become one, 120 warehouse writes become three, and 24 duplicate emails become zero.
- Day 07 is where reality pushed back. We throttled the image renders to exactly the provider's limit (5 per 10 seconds) and still got 429s. Measuring the call times explained it: Inngest's throttle spaces run starts evenly (one every 2 s) after a small burst, but our fake provider counts any 10-second sliding window. Two reasonable definitions of "5 per 10 seconds" disagree at the edges.
- That's a real-world lesson as much as a test bug: "rate limit" means different math at different providers. Changing the shared fake is a human call, so we stopped and laid out the options. The pick was to make the fake a token bucket (five calls up front, then one more every 2 s), which is how most real APIs and Inngest's own throttle count. Lesson code didn't change, and the burst now finishes in about 24 s with zero 429s.
- The "before" for Day 07 also raised a question about honesty versus snappiness. The wall of 429s shows up within seconds, but the retries behind it take minutes of real backoff. That's the point of the episode, so the scenario only asserts the wall, and the README tells viewers the stragglers trickle in later.
- Day 09's fan-out reused a Phase 3 investment for free: the chaos middleware already passes the parent's failure plan into `step.sendEvent` children, so "delivery #25 fails once" works across 50 separate runs without any lesson code knowing.
- Day 09's "before" is the loop-inside-a-step anti-pattern from a customer call, and it makes the most visceral demo so far: the retry resends the card to friend1 through friend24, and the log shows every one.
- Generating the starter branch caught a bug from Phase 3. When a lesson region removes a whole function (Days 03 and 05), the `functions` array still mentions it and the starter doesn't compile. The fix doubles as a lesson beat: "register the new function" is now its own tiny TODO, with a stub that leaves it out.
- Batching's handler takes `events`, not `event`, so the starter's stub swaps in the naive one-insert-per-event handler. The code-along starts from exactly the "before" behavior and ends at three writes.
- Priority needed no tricks. With a concurrency limit of 2 forming a queue, two pro cards that arrive late jump ahead of twenty free ones. The same "send the late arrivals 2 s after the burst" timing from Day 06 kept it steady.

## Phase 4b: ledger wall

- Halfway through, we asked whether each day needed a UI. The Dev Server already shows the runs, but the proof of each lesson lived in terminal lines like `billed $0.004 (call #3)`, which is tiny on camera. The numbers that matter are counts and orderings, and those deserve to be big.
- So every day now serves one shared page at its own port: big tallies for LLM bills, image 429s, deliveries in order with duplicates in red, and warehouse writes. They're the same numbers the scenario tests check, read from the same ledger.
- It's one static HTML file in the shared package, with no framework and no build step. Each day's `index.ts` is still a single `startServer` call, and none of it counts as lesson code, so the starter branch and the line budgets don't change.
- Three days have a human as the trigger, and `pnpm send` hides that. Day 04 got Request and Approve buttons, so the presenter plays the approver. Day 08 got two text boxes that send an event on every keystroke, with and without debounce. Typing "Hi team!" bills eight times in one box and once in the other, which shows the lesson better than any scripted burst. Day 12's reaction buttons come with Day 12.
- One catch from testing: our browser automation typed whole words as a single input event, so the first debounce demo looked broken. Sending one event per character, the way a person types, fixed it.
- The page sends events through the day's own client, and only accepts event names that day lists. A stray request can't fire `card/deleted` at Day 05 by accident.
- The colors are named variables at the top of the file, including the four level colors from the Notion tech spec. The designer can brand it without touching code.

## Phase 5: Day 12

- The last day answers "we changed the prompt; is it better?" with three new beta APIs: an experiment that splits traffic between two prompt tones, a score recorded during the run, and a deferred scorer that waits for the recipient's reaction and credits it to the right variant. It fits in 32 of its 35 lesson lines.
- The scorer is the nicest idea of the series: it's an ordinary durable function that can sit on `waitForEvent` for a week, so "did they love it?" becomes a score without a feedback table or a cron job.
- The SDK fought the build before the lesson did. TypeScript refused to build the Day 12 client because the scoring middleware's type references an internal SDK type that isn't exported, and our composite build writes declaration files. Day 12 now typechecks on its own with `--noEmit`, and it's logged to report upstream.
- The scenario has to be patient in the right place. A reaction only counts if its scorer is already waiting, so the script waits for all 40 deliveries before any recipient "reacts". Same lesson as Day 04's approval race.
- Then the check said all 40 card runs were still Running. They weren't: we compared one card before and after a reaction and watched the Dev Server flip the finished parent run back to Running the moment its deferred score landed. That's a beta quirk, so the check now verifies those runs through the ledger.
- That answered an open question from the start of the project: the local Dev Server doesn't display experiments or scores yet, and says so on its own pages. The "one variant pulls ahead" shot needs Inngest Cloud, or a scoreboard on our ledger wall. The README says so plainly instead of promising a view that isn't there.
- Since the payoff lives in Inngest Cloud, Day 12 is recorded against Cloud. The catch is that Cloud normally calls your app over HTTP, and a laptop on a film set has no public URL. Inngest Connect flips the direction: the app dials out over a WebSocket and Cloud sends it work. `pnpm day 12 --cloud` does exactly that, while the ledger wall stays on localhost.
- We couldn't test against Cloud without the shoot's keys, but Connect also talks to the local Dev Server. Running the full 40-card experiment through that path proved the wiring before anyone needs a signing key.
- The final pass was a script, not a skim. It checked every README for the template's six headings, a two-sentence problem with no feature names, and `pnpm send` commands that name real scenarios. All twelve passed on the first run, which says more about writing the READMEs right after each day passed than about the audit.
- The lesson budgets turned out generous, which is the right way round. Flow-control days are a single line of config (1 of 5), and the heaviest day, Agent Evals, uses 32 of 35. The point of the series is how little code each fix takes, and the numbers back that up.
- The last gate: all 12 days, 55 checks, every scenario under 40 seconds, and a starter branch that typechecks from Day 01 to Day 12. Twelve days of workflows, each one runnable, testable and filmable from one command.

## Readability sweep

- With every day passing, we pictured the real episode: three minutes, Jason explaining his card business's problem, an engineer walking him through the fix on screen. Then we had a fresh reviewer read all twelve days with only that picture in mind and no memory of how the code got there.
- The most repeated line in the series turned out to be the widest: `sendCard({ to: event.data.to, cardId: event.data.cardId })`, on screen in nine episodes at 96 characters. It's now `sendCard(event.data)`. Small, but it's the line viewers see most.
- The code formatter was quietly making lessons harder to read. It broke Day 11's one-line batch handler into a five-line staircase and Day 12's experiment into a column of names. Pulling one value into a named variable first (`opens`, `prompt`, `deliveries`) fixed all three, and each line now says one thing.
- The story leaked through the test data. Every card was "delivered to jason@example.com", but Jason runs the shop. Cards now go to grandma, with a message that fits, and the bulk scenarios say "Happy holidays from all of us" instead of "Holiday card c7".
- Two real bugs surfaced. Day 01's code-along starter never delivered the card, because the delivery step had no stub. And Day 07's "before" leaves retries running that can leak 429s into the fixed run, so the README now says to restart between them.
- Day 05 reused Day 04's `card/approved` event with a different shape. Anyone watching both would see one event mean two things, so Day 05's is now `card/scheduled`.
- Making the test data friendlier broke Day 07. Every card in the burst got the same message, and the fakes derive their timing from the text, so all fifteen finished writing at the same instant and hit the throttle together. Personal greetings ("Happy holidays, Alex!") fixed the realism and the spread.
- That exposed a real lesson. Throttling at exactly the provider's limit (5 per 10 s) still failed about one run in three: the Dev Server sometimes starts six renders at once, and a strict provider rejects the sixth. Throttling at 4 passed every run. That's what you'd do in production anyway, so Day 07 now teaches leaving a little headroom under the provider's limit.
- Day 04 finally got a real "break it". Its old one ran the fixed code's timeout, so there was nothing for Jason to react to. Now the naive version saves the draft and mails it to grandma before anyone has looked, and the fix adds the pause. The on-camera approval window also went from 5 seconds to 15, enough time to actually click Approve.
- Names that mislead on screen got renamed. An invoke-only trigger called `imageRequested` looked like an event that didn't exist, so it's now `invokedWithText`. Day 09's imperative `card/deliver` became `card/delivery.requested`, and its function is now `send-to-everyone`, the same as the episode's title.
- Day 12's scorer dropped a hand-built CEL string for `match: "data.cardId"`, the same pattern Day 04 already taught. It worked on the deferred trigger first try, and the lesson got four lines shorter.
- Two episodes were each trying to teach three things. Day 02 now leads with "fail fast and tell the sender", and Day 05 with "sleep until the date, unless it's deleted". Retry-after and the nightly cron are now short "one more" beats at the end. No code was removed.

## Day 12 Cut B

- The Notion spec added a second take on Day 12: a card-designer agent that writes each card as code and runs it in a sandbox. The pitch is "the agent is the brain, the sandbox is the hands, and durable execution keeps score", so the day is the experiment from Day 12 with a sandbox in the middle.
- We kept the agent's output as small as possible: a Node program that prints an SVG. The sandbox runs it with `node -e`, so there's no headless browser and no new dependency, and the finished card is just text in the run's output.
- The new fake, `designCard()`, breaks the first design for some cards by misspelling one variable, so Node exits with a `ReferenceError` the agent can read. The break is rolled once per card, and "bold" breaks more often than "classic", so the render score really does differ by variant. Card c1 breaks in both, which makes the revision beat reliable on camera.
- A sandbox failure is data, not an exception: `commands.run` returns the exit code and stderr. That made the revision a plain `if`, and we kept it to one retry on purpose.
- The SDK nudged us twice. `step.score()` has no experiment option, so crediting a score to a variant uses `inngest.score.experiment()` at the function body. And creating a sandbox requires CPU and memory, which cost three lines of the budget.
- The Day 12 scorer moved out of the lesson markers, since it's the same one viewers already saw. That left the new lesson at 32 of 35 lines.
- We can't test any of the sandbox calls here. They're an open beta on Cloud, and the local Dev Server only runs them after `inngest login`. So `pnpm check` prints SKIP for this day, still checks the lesson budget and types, and the README says what to run after logging in.
- The scripts assumed two-digit day folders and port 3000 + NN. They now accept `12b` and map it to port 3112, so it never clashes with Day 12.

## Hearth Post screens

- The old ledger wall was a pile of generic service panels, so we swapped in the Hearth Post design system: cranberry brand, four level colors, a type scale meant to be read from across a room. Days 01, 06 and 07 got bespoke screens first. Every other day gets the same ledger numbers in the new styling, so nothing broke.
- Before and After needed one new fact: which function made each call. The chaos middleware already wrapped every run in `AsyncLocalStorage`, so we stored the function id there and the ledger stamps each entry with `fn`. Anything ending in `-before` is the broken run. That's a small `@12days/shared` contract change, and the log lines and scenario assertions didn't move.
- Day 01 is one big number: "LLM billed 3×" next to the card, with a receipt of hatched repeat bills. Fixed, it shows a single bill and two dashed "saved" ticks. Day 06 puts Maisie's queue spot front and center: #21 of 21 before the fix, #3 after, with lanes that fill in as cards go out. Day 07 is a grid of image calls, a wall of red 429 tiles broken and all green fixed.
- The view follows the run that started most recently, but retries from the old broken run kept trickling in after a Reset and flipped the page back. The wall now remembers which card and side pairs it has seen and only switches on a new one. A fresh page load mid-run can still guess wrong, so the Before, After and Side by side buttons are always there.
- The Day 07 broken run still has minute-long retries behind it, and they drain the same token bucket the fixed run uses. If you run the fix straight after, you'll see a stray 429 on the fixed side. Restarting `pnpm day 07` between takes keeps it clean.
- No build step, no new dependencies: the design system's CSS is copied into `packages/shared/src/wall/hearth.css` (tokens generated from its `tokens.json`) and served at `/wall.css`. Biome skips that file since it's vendored.

### Hearth Post screens, batch 2 (Days 02, 03, 08, 09, 11)

- Five more days got their own screens, all in the same `index.html`: a view function per day, the same Before / After / Side by side switch, no new dependencies. The Day 03 timeline and card preview came out so close to the design system's day-states that most of the work was reading the ledger the right way.
- Day 03 told us the design doc was one off. It says the broken run reads "↻ 4", but the default is 4 retries after the first try, so the painting step fails five times before it gives up. The wall says five. The Notion spec should say five too.
- Day 02 hit a wall we couldn't paint over. The Grinch card dies in the moderation step, and moderation isn't a ledger call, so the broken run leaves no trace at all: the "stuck retrying, nobody told" side has nothing to draw. The fixed side is great (Rejected stamp, "No retries", a "Sender notified" toast), and the 429 beat shows the gap between the failure and its retry. Giving the broken side something to show is a `@12days/shared` change (record moderation calls), so we left it as a proposal.
- Day 08 needed a trick. The debounce swallows the keystrokes, so the ledger can't tell you someone is mid-sentence. The page counts the edits it sends from its own text box, shows "Waiting for quiet", then the single tick, with dashed "saved" ticks for the edits that never turned into a bill. Typing from the terminal scenario just shows the one tick.
- Day 09 turned out nicely as a grid of recipients: 24 hatched ×2 tiles broken, 50 checks and one ↻ fixed. Day 11's dollar figure is a constant in the page ($0.002 a write), because the warehouse ledger entry knows rows, not money.
- Phones got a small fix while we were in there: the Before / After / Side by side switch pushed the page 10 px wide on a 390 px screen, and "for this text" wrapped under the big number. The fallback view also stopped saying "1 calls recorded".
- A footgun worth knowing for the shoot: leftover `tsx watch` processes from an earlier `pnpm day` can keep a port and a Dev Server alive, so the next run silently lands on :8290. If a scenario seems to do nothing, check what is listening on 8288.

## Phase: Product-style feed copy

- The status feed next to the trace used to talk like a demo: a painter dropping brushes, a mail elf on the ice, a writer losing their train of thought. We rewrote every line to sound like a card product that wants its customer to feel looked after: "Having trouble reaching the image service, trying again (2)".
- Failures now say what happened and what to expect. "We could not deliver your card. Please try sending it again." beats "Could not reach the inbox".
- A card that stops no longer just stops. Every step a real product would show stays on screen, and the ones never reached read "Card not delivered" or "Artwork not created" instead of disappearing.
- Reasons live in the line, like Day 02's "You were told why: …", all read from data we already had: the ledger's notify note, the event's `deliverAt`, a run's output.
- Waiting got its own wording. Day 05 says when delivery is scheduled, Day 04 says nothing is sent until you approve, Day 07 says the card is waiting for a turn with the image service.
- An expired Day 04 draft used to show "You approved it" because the wait step finishes when it times out. It now says you did not approve in time, and the delivery shows as not done.
- Partial results read plainly too: Day 09 says "Could not deliver to 1 of 50 people. 49 delivered." and Day 12 counts "28 of 40 recipients loved it".
- One real drift surfaced: the Day 07 trace label said "3 painter calls per 3 seconds" but the code throttles 4 per 10 seconds. The label now matches the code.
- Day 12b's profile pointed at `create-card` and step ids the day never uses, so its feed could never have worked. It now follows `design-card`; it is cloud-only, so that one is untested.
- The bottom strip is now a real status bar: "Connected · 1 card in progress · 3 cards delivered · Last delivery 2:14 pm", with day-specific lines like "1 card needs your approval" or "120 card opens recorded". The lesson figures ("Billed twice", retries, duplicates) didn't go anywhere: they are the same strip, shown only in presenter mode (press `p`), so the videos still get their payoff.
- Days 06 and 10 now draw their queue: one strip, two uses. Day 10 shows a single line where the pro card slides to the front and finishes 3rd; the "no priority" run shows it last. Day 06 shows a lane per account, so Brightside's lone card is plainly not stuck behind Acme's twenty, while the shared-lane version has it at the back. Everything is read from the runs themselves (arrival time, plan or account, step starts, finish times). The one thing the studio didn't have was when a run was queued: the Dev Server's run start time is when it began running, not when it arrived, so we read the queued-at time too.

## Phase: Two tabs, a coworker, and a calmer arc

- Filming wants two browser tabs, so the in-page "problem / fix" toggle is gone. Every day with a before now has `/day/06/problem` and `/day/06/fix`; days without one have a single address.
- The tabs are labeled "Without Inngest" and "With Inngest" instead of "The problem" and "The fix", which sounded like a demo.
- The sneaky part was shared state. The studio remembered one run cursor, one "sending" flag and one set of results, so a second tab would have wiped the first. Each side is now its own screen.
- The two sides also share one ledger in the day's app. Instead of changing the fakes, each tab reads only the calls made by its own functions (the `-before` ones or the rest), and a send only wipes the ledger when the other tab is idle.
- The side-by-side strip went away with the toggle. The two tabs are the comparison now; presenters still get this tab's numbers in the drawer.
- Grandma retired. Cards now go to a coworker, Sam, with a "Happy holidays, Sam!" message, and every send script and README says so. The shared wall page still falls back to the old address, which is not ours to change.
- Copy got a pass for one message per day: the masthead no longer names the lesson, "One card is easy. A rush shows who waits." is gone, and Day 12's hint no longer says which style wins.
- The masthead stamp now reads "12 Days of Inngest · Day 6" so it can be cropped straight into a lower third.


## Phase: Readable on camera (presenter review)

- Tony walked through the days as a viewer would, and two things got in the way of the code we actually want people to look at. Neither was about Inngest. Both were about the page.
- Every `before.ts` opened with an inline event definition: a schema, a type import and an `eventType` call, all before the first line of the naive function. That's typing noise on the one file whose job is to be glanced at. Those definitions now live in each day's `events.ts`, right beside the event they mirror, and `before.ts` just imports them. Same names, same event strings, same typed `event.data`.
- The second note was that the handlers read as a wall. Each step is a separate thing that happens, so each one now gets a blank line, including before the final `return`. Options objects, nested callbacks and loops are untouched; this is purely breathing room between statements.
- Inside lesson regions the blank lines sit between the real lesson statements, while the `@lesson` markers and stub lines stay exactly where they were. Lesson budgets count non-blank lines, so they didn't move.
- Stripping the markers came up too, and we did not decide it. They all stayed in place, along with every other readability idea that was floated (shorter calls, step id renames, reflowed options).
- The starter copies were regenerated and the README snippets updated to match the new code.
