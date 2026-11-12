# 12 Days of Workflows

Jason runs a holiday card business. A customer types a message, an AI writes the card, an image service paints it, and it lands in their inbox. Each day fixes one problem that shows up in the holiday rush, with a small, runnable [Inngest](https://www.inngest.com) example.

You get 12 standalone examples (plus a bonus), a studio UI that shows what Inngest is doing as you run them, and a `starter` branch you can code along with.

## How to use

You need Node 22 or newer and pnpm 9. Then install once from the repo root:

```bash
pnpm install
```

Every day lives in `days/NN-slug/` and follows the same loop: break it, then fix it. Start the day you want to try:

```bash
pnpm day 07
```

This runs day 07 on port 3007 (day NN uses port 30NN) and starts the Inngest Dev Server at http://localhost:8288. Leave it running in its own terminal. The Dev Server is where you watch runs, steps, retries and queues.

In a second terminal, send the naive version's events. Each day's README names its scenarios, and the "before" one ends in `-before`:

```bash
pnpm send 07 burst-before
```

Watch the problem happen in the `pnpm day` output and in the Dev Server's Runs tab. Then send the fixed scenario, which has the same name without `-before`, and compare:

```bash
pnpm send 07 burst
```

To see every scenario a day has, with a description of each:

```bash
pnpm send 07 --list
```

For a friendlier view, run the Holiday Card Studio in a third terminal and open http://localhost:3100:

```bash
pnpm studio
```

Fill in the card form and press Send card. A plain-language status feed follows the run, the dark panel beside it shows the real Inngest steps, and the switch at the top flips between the problem and the fix. The numbers that prove the lesson (billed once, zero duplicates, paid cards first) are kept for both. Scenarios, as `pnpm send` runs them, live in a presenter drawer (`?presenter=1`), and the **Dev Server** button (or `d`) slides the real Dev Server UI up over the page.

Some scenarios need an environment variable, such as a rate limit for the fake image service or a shorter timeout. The day's README shows the exact line, and the presenter drawer prints it too. The variable goes on `pnpm day`, not on `pnpm send`, and a running app cannot pick up a new one, so restart the day with it set (`pnpm send` prints this line for you when a scenario needs it):

```bash
IMAGE_RATE=5/3s pnpm day 07
```

Day 04 is the one day where you restart between scenarios (a 5-second timeout for `ignore`, 30 seconds for `approve`).

To code along, use the `starter` branch. It has the same repo with each day's lesson code replaced by a `TODO` where you write it (a few stubs keep it compiling). It is generated from `main` by `pnpm starters`, so the two never drift.

```bash
git checkout starter
```

Day 12b is different. It runs agent-written code in an Inngest Sandbox, which is an open beta, needs the Pro plan, and only works on Inngest Cloud. Everything else runs locally. See [days/12b-design-agent/README.md](days/12b-design-agent/README.md) for the two ways to connect it.

To run the assertions for every scenario, or for one day, and to lint:

```bash
pnpm check
pnpm check 07
pnpm lint
```

`pnpm check` starts its own Dev Server and app, so stop any `pnpm day` first.

If something looks off:

- Nothing shows up in the Dev Server or the studio says a day is down: check that `pnpm day NN` is still running in a terminal.
- The Dev Server will not start because port 8288 is busy: stop the other Inngest Dev Server and run again.
- `pnpm day all` starts every day at once. Every day reacts to the same `card/requested` event, so one scenario starts runs in all of them. Run one day at a time.

## The days

| Day | Folder | The problem | What it teaches |
| --- | --- | --- | --- |
| 01 | [survive-failure](days/01-survive-failure) | My LLM call failed and took the whole request down | `step.run` durable steps and retries |
| 02 | [fail-fast](days/02-fail-fast) | Stop retrying things that are never going to work | `NonRetriableError`, `RetryAfterError`, `onFailure` |
| 03 | [split-the-work](days/03-split-the-work) | My flakiest API is setting the rules for my whole workflow | `step.invoke` and per-function retries |
| 04 | [wait-for-a-human](days/04-wait-for-a-human) | I need a human to say yes before this goes out | `step.waitForEvent` |
| 05 | [deliver-on-the-25th](days/05-deliver-on-the-25th) | Send this on Christmas morning, unless they cancel | `step.sleepUntil`, cron, `cancelOn` |
| 06 | [one-user-per-lane](days/06-one-user-per-lane) | One customer sent 20 cards and now everyone else is waiting | `concurrency` with keys |
| 07 | [respect-rate-limits](days/07-respect-rate-limits) | The image API is rate-limiting us and our retries are making it worse | `throttle` |
| 08 | [wait-for-quiet](days/08-wait-for-quiet) | Users smash the regenerate button and we pay for every click | `debounce` |
| 09 | [send-to-everyone](days/09-send-to-everyone) | Our bulk send failed halfway and 24 people got the card twice | `step.sendEvent` fan-out |
| 10 | [paid-users-first](days/10-paid-users-first) | Paying customers are stuck behind free-tier traffic | `priority` |
| 11 | [batch-the-boring-stuff](days/11-batch-the-boring-stuff) | We're paying for 120 database writes that could be three | event batching |
| 12 | [measure-what-works](days/12-measure-what-works) | We changed the prompt. Is it actually better? | Agent Evals experiments and deferred scoring |
| 12b | [design-agent](days/12b-design-agent) | The agent writes code. Where does it run? | A card-designer agent renders its cards in an Inngest Sandbox |

## Where things live

- `days/`: one folder per day, each with its own README, `src/functions.ts` (the lesson) and `send.ts` (the scenarios). Days import only from `inngest` and `@12days/shared`, never from each other.
- `packages/shared/`: the fake services every day uses (LLM, image renderer, email, database) and the helpers around them. The fakes are deterministic, so every run reproduces, and they never touch the network.
- `studio/`: the Holiday Card Studio, a small server and plain HTML page. See [studio/README.md](studio/README.md).
- `ui/`: the CSS kit that the studio and each day's browser page share. See [ui/README.md](ui/README.md).
- `scripts/`: what `pnpm day`, `send`, `check` and `starters` run.
- `finale/`: an empty scaffold for the livestream build.
- [SPEC.md](SPEC.md) is the full build spec, and [BUILD_LOG.md](BUILD_LOG.md) tells the story of how it was built.

All the examples use the Inngest TypeScript SDK v4 (`inngest@^4.8.0`), where triggers go in the options object of `createFunction`. If you know v3, the syntax will look slightly different.

Released under the MIT license; see [LICENSE](LICENSE).
