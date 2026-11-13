# Day 05: How do I send a card on the 25th, and not send it if it was deleted?

**Key idea:** `step.sleepUntil()` waits for a date, and `cancelOn` ends the run if something
changes.

## Problem

Cards should arrive on a chosen date. In between, the sender may delete the card, and abandoned
drafts pile up unless something cleans them nightly.

## Break it

```sh
pnpm day 05
pnpm send 05 delete-before-delivery-before
```

The card is scheduled 10 seconds out and deleted after 2. The sleeping run never hears about it,
so `[mail] sendCard c1 delivered …` still appears.

## Fix it

```ts
cancelOn: [{ event: cardDeleted, match: "data.cardId" }],

await step.sleepUntil("wait-for-delivery-date", event.data.deliverAt);
```

```sh
pnpm send 05 scheduled
pnpm send 05 delete-before-delivery
```

`scheduled` delivers five seconds after you send it. `delete-before-delivery` ends as Cancelled
with no mail.

### One more: a nightly cleanup

A cron trigger cleans up drafts at 3am. A second, event trigger lets you run it now:

```ts
triggers: [{ cron: "TZ=America/New_York 0 3 * * *" }, cleanupRequested],
```

```sh
pnpm send 05 cleanup
```

## Watch it

- Dev Server (http://localhost:8288): `wait-for-delivery-date` shows as a sleep with its wake-up
  time, and the run flips to Cancelled on deletion. The cleanup function lists both triggers.
- Ledger wall (http://localhost:3005): a delivery after `scheduled`, none after
  `delete-before-delivery`.

## In your app

Replace "scheduled_at" columns and the job that scans them with an event that carries the date
and a `sleepUntil`. Add `cancelOn` for every event that makes the work pointless: deletion,
unsubscribe, refund.

## Next

So far every card has been on its own. Tomorrow one account sends twenty at once.
