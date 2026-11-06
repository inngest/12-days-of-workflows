# 12 Days of Workflows

Twelve short lessons in building reliable workflows with [Inngest](https://www.inngest.com), one
per day, all built on the same small app.

## The story

Jason runs a holiday card business. Customers type a message, an AI writes the card, an image
service paints the artwork, and the card lands in the recipient's inbox. It works fine in
November.

Then the holiday rush hits. Services fail, customers pile in, the bills grow, and Jason needs to
know whether the new cards are any good. Each day is one of those problems, and one fix that
keeps the business running through the season.

| Level | Day | Jason's problem |
| --- | --- | --- |
| Make it work | [01](days/01-survive-failure) | The image service hiccups and he pays for the same card text three times. |
| | [02](days/02-fail-fast) | The Grinch orders a card that can never pass moderation, and it retries anyway. |
| | [03](days/03-split-the-work) | The flakiest service decides when the whole card gives up. |
| Make it scale | [04](days/04-wait-for-a-human) | Customers want to approve their card before it goes out. |
| | [05](days/05-deliver-on-the-25th) | Cards must arrive on the 25th, and a deleted card must never send. |
| | [06](days/06-one-user-per-lane) | One company orders 20 cards and every other customer waits. |
| Make it faster | [07](days/07-respect-rate-limits) | The image service starts rate limiting, and retries make it worse. |
| | [08](days/08-wait-for-quiet) | The live preview bills an AI call on every keystroke. |
| | [09](days/09-send-to-everyone) | One card goes to 50 people, and a failure resends it to half of them. |
| Make it profitable | [10](days/10-paid-users-first) | Paying customers wait behind the free tier. |
| | [11](days/11-batch-the-boring-stuff) | Every "card opened" is its own billed database write. |
| | [12](days/12-measure-what-works) | He rewrote the card prompt. Do recipients actually love it more? |
| | [12b](days/12b-design-agent) | An AI agent designs each card as code. Where does that code run, and is it any good? |

The AI, image, mail and database services are fakes in `packages/shared`. They fail on cue and
keep a ledger of every call, so you can see exactly what each fix saves. No API keys needed.

## Run a day

Requires Node 22+ and pnpm.

```sh
pnpm install
pnpm day 01                          # the app on :3001, the Inngest Dev Server on :8288
pnpm send 01 flaky-image-before      # break it
pnpm send 01 flaky-image             # fix it
```

Each day's README walks through the break-it and fix-it scenarios. Open http://localhost:8288 to
watch the runs, and http://localhost:30NN for that day's ledger wall.

## Code along

The `starter` branch has every lesson cut out and replaced by a `// TODO:`, so you can write the
fix yourself. It's generated from `main` and typechecks on its own.

```sh
git checkout starter
```

`pnpm check NN` runs a day's scenarios as tests, so you'll know when your fix works.
