# Holiday Card Studio

The screen for Jason's holiday card business, shown in every episode. It looks like a product:
send a card on the left, watch it being made in the middle, and see what Inngest really did on
the right. It follows whichever day you started.

## Run it

```bash
pnpm day 01        # terminal 1: the day and the Dev Server
pnpm studio        # terminal 2: http://localhost:3100
```

### Days 12 and 12b: Inngest Cloud

These two are filmed against Inngest Cloud. Set both keys and the studio switches itself, with no
flag. Days that run locally keep using the Dev Server even when the keys are set.

```bash
export INNGEST_SIGNING_KEY=signkey-… INNGEST_EVENT_KEY=…
pnpm day 12 --cloud    # terminal 1: the day, connected to Cloud (no Dev Server)
pnpm studio            # terminal 2: it picks up the keys from the same shell
```

- **Detection**: both keys are set in the studio's environment, and the selected day needs Cloud
  (Day 12 or 12b). Day 12 also runs locally: start the studio without the keys for that.
- **Sends** (Send card, the Presenter scenarios, the approve / react buttons) go to Inngest Cloud
  with the event key, like `pnpm send NN --cloud`. Key values never reach the page.
- **Status bar** says "Connected to Inngest Cloud".
- **The Dev Server slide-up** becomes **Inngest Cloud**: Cloud refuses to be shown inside another
  page, so a button opens the runs page in a new tab (`INNGEST_ENV` picks the environment, default
  `production`).
- **The live card** is driven by the day's own ledger of provider calls (message written, card
  delivered), because run data in Cloud needs the Cloud REST API. There is no step trace or
  "problem / fix" strip in this mode; follow the steps in Cloud.
- **Without the keys**, Day 12b says what to set instead of sending, and Day 12 just runs locally.

## What you see

- **Send a card**: a short form. Which fields show depends on the day (an account on Day 06, a plan
  on Day 10, a delivery time on Day 05). Send fires the day's real event through the Dev Server.
  Days about load add one button for a rush of cards.
- **Your card, live**: the steps in plain language as they happen, retries and waits included,
  then the finished card. A stamp sums up the run ("Billed once", "Coal-proof").
- **Under the hood**: the same run as the dark trace, with the real names (`step.run`,
  `step.invoke`, `step.waitForEvent`) and the function option the day teaches.
- **The problem / The fix** (top right): sends to the day's `.before` event or the real one. The
  last result of each side stays in a slim strip pinned to the bottom of the screen, with the side the switch points at gently highlighted. Days with no "before" (04, 12, 12b) say so.

Some days pause for you: Day 04 shows **Approve the card**, Day 05 **Changed my mind: delete it**.

## Dev Server slide-up

The **Dev Server** text in the masthead (or press `d`) slides the real Inngest Dev Server up over the
whole page, with **Close**, **Escape**, **Open in a new tab**, and **Show current run** when the
studio has moved on to a newer card. It opens on the card's run (`/runs?runID=...`), or the runs
list, and loads only on first open. If the Dev Server is down it says how to restart the day.

## Presenter drawer

Add `?presenter=1` (or press `p`) for the scenario launcher: the same scenarios as `pnpm send`,
their env hints, and **Clear**. A running app cannot take a new env var, so the drawer prints the
line to restart with, such as `IMAGE_RATE=off pnpm day 06`. Day 12b's scenarios need the Cloud keys (see above).

## Where the data comes from

- `src/days.ts`, `src/ledger.ts`: which days answer on 3001 to 3013, and their ledger counters
- `src/devserver.ts`: runs and steps from the Dev Server's GraphQL (1.5 s timeouts, so a restart never stalls the page)
- `src/profiles.ts`: per day, the event names, form fields, defaults and what to follow
- `src/words.ts`: step id to friendly copy; `src/feed.ts`: feed lines and trace rows; `src/proof.ts`: the numbers and stamps
- `src/cards.ts`: form to events; `public/`: plain HTML, CSS and JavaScript on top of `ui/`

`@12days/shared` and the days are untouched; the studio never imports a day's lesson code.
