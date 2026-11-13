# Holiday Card Studio

The screen Jason's business runs on, shown in every episode. Send a card on the left, watch it
being made in the middle, and see what Inngest did on the right.

## Run it

```sh
pnpm day 06      # terminal 1: the day and the Dev Server
pnpm studio      # terminal 2: http://localhost:3100
```

The studio opens the newest running day. Port 3100 can be changed with `STUDIO_PORT`.

## Two tabs: problem and fix

Every day with a "before" has two pages:

| Address | Shows | Sends to |
| --- | --- | --- |
| `/day/06/problem` | Without Inngest | the `-before` function |
| `/day/06/fix` | With Inngest | the real function |

Open both in two browser tabs. Each tab keeps its own state, so sending from one never clears the
other. `/day/06` opens the fix. Days 04 and 12 have no "before", so they have one page: `/day/04`.

## What you see

- **Send a card**: a short form. The fields depend on the day (an account on Day 06, a plan on
  Day 10, a delivery time on Day 05). Days about load add a button for a rush of cards.
- **Your card, live**: the steps in plain words as they happen, then the finished card.
- **Under the hood**: the same run with the real names (`step.run`, `step.waitForEvent`) and the
  option the day teaches.

Some days pause for you: Day 04 shows **Approve the card**, Day 05 **Changed my mind: delete it**.

## Shortcuts

- **`d`**, or the "Dev Server" link: slides the real Dev Server over the page.
- **`p`**, or add `?presenter=1` to any address: the scenario launcher for the tab's side.
  Press **Clear** to reset the tab.

## Day 12 and Inngest Cloud

Set both keys before starting the studio and it sends to Inngest Cloud, with no flag:

```sh
export INNGEST_SIGNING_KEY=signkey-… INNGEST_EVENT_KEY=…
pnpm day 12 --cloud
pnpm studio
```

Cloud can't be shown inside the studio, so the Dev Server slide-up becomes a button that opens
your Cloud runs page (set `INNGEST_ENV` for an environment other than `production`). The live
card follows the day's own ledger, so there is no step trace in this mode. Without the keys, Day
12 runs against the Dev Server.

## Code map

- `src/days.ts`, `src/ledger.ts`: which port each day uses, and its ledger counters
- `src/devserver.ts`: runs and steps from the Dev Server
- `src/profiles.ts`: per day, the event names, form fields and what to follow
- `src/words.ts`, `src/feed.ts`, `src/proof.ts`: plain-language copy, feed lines, stamps
- `src/cards.ts`: form to events. `public/`: the page

The studio never imports a day's lesson code.
