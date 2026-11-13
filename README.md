# 12 Days of Workflows

Twelve short lessons in building reliable workflows with [Inngest](https://www.inngest.com), one
per day, all on the same small app.

## The story

Jason runs a holiday card business. A customer writes a message, an AI writes the card, an image
service draws the artwork, and the card lands in the recipient's inbox (this season, Sam's). It
works fine in November. Then the rush hits, and each day fixes one problem.

| Day | Problem |
| --- | --- |
| [01](days/01-survive-failure) | The image service hiccups and you pay for the same card text three times. |
| [02](days/02-fail-fast) | A card that can never pass moderation keeps retrying. |
| [03](days/03-split-the-work) | The flakiest service decides when the whole card gives up. |
| [04](days/04-wait-for-a-human) | The sender wants to approve the card before it goes out. |
| [05](days/05-deliver-on-the-25th) | Cards must arrive on the 25th, and a deleted card must never send. |
| [06](days/06-one-user-per-lane) | One company orders 20 cards and every other customer waits. |
| [07](days/07-respect-rate-limits) | The image service rate limits you, and retries make it worse. |
| [08](days/08-wait-for-quiet) | The live preview bills an AI call on every keystroke. |
| [09](days/09-send-to-everyone) | One card goes to 50 people, and a failure resends it to half of them. |
| [10](days/10-paid-users-first) | Paying customers wait behind the free tier. |
| [11](days/11-batch-the-boring-stuff) | Every "card opened" is its own billed database write. |
| [12](days/12-measure-what-works) | You rewrote the prompt. Do recipients actually like it more? |

The AI, image, mail and database services are fakes in `packages/shared`. They fail on cue and keep
a ledger of every call. No API keys needed.

## Run a day

Needs Node 22+ and pnpm.

```sh
pnpm install
pnpm day 01      # the app on :3001 and the Inngest Dev Server on :8288
pnpm studio      # the Holiday Card Studio on :3100
```

Day `NN` runs on port `30NN`. Open the Dev Server at http://localhost:8288 to watch runs.

### Before and after

Each day has a problem and a fix, each in its own studio tab:

- http://localhost:3100/day/01/problem: without the lesson
- http://localhost:3100/day/01/fix: with it

Open both, send a card from each, and compare. Days 04 and 12 have one page, `/day/04`. See
[studio/README.md](studio/README.md).

Prefer the terminal? Each day's README lists its scenarios:

```sh
pnpm send 01 --list                  # scenarios for a day
pnpm send 01 flaky-image-before      # break it
pnpm send 01 flaky-image             # fix it
```

Every scenario finishes in under a minute.

## Code along

The `starter` branch has each lesson cut out and replaced by a `// TODO:`. You write the fix.

```sh
git checkout starter
```

`main` also keeps a starter copy of each day in `days/NN-slug/starter/`. Run `pnpm check NN` to
test your fix against the day's scenarios. `pnpm starters` rebuilds the `starter` branch from
those copies.

## Cloud days

Day 12 compares two prompts, and Inngest Cloud shows the result (the Dev Server can't yet). Set
your keys and run it against Cloud:

```sh
export INNGEST_SIGNING_KEY=signkey-… INNGEST_EVENT_KEY=…
pnpm day 12 --cloud
pnpm send 12 experiment-40 --cloud
```

With both keys set, `pnpm studio` sends to Cloud too. Without them, Day 12 runs locally.

## Commands

| Command | Does |
| --- | --- |
| `pnpm day NN [--cloud]` | Runs a day (`pnpm day all` runs 01 to 12) |
| `pnpm send NN [scenario] [--cloud]` | Sends a scenario's events |
| `pnpm check [NN]` | Typechecks and runs scenario assertions |
| `pnpm starters` | Rebuilds the `starter` branch from the starter copies |
| `pnpm lint` | Lints |
