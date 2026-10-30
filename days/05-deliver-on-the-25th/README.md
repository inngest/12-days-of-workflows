# Day 05: How do I send a card on the 25th, and not send it if it was deleted?

## The problem

Cards should arrive on a chosen date, not when they were written. In between, the sender might
delete the card, and abandoned drafts pile up unless something cleans them up every night.

## Break it

```sh
pnpm day 05
pnpm send 05 delete-before-delivery-before
```

The card is scheduled 10 seconds out and deleted after 2. The sleeping run never hears about the
deletion, so `[mail] sendCard c1 delivered …` still shows up: a deleted card reaches its recipient.

## Fix it

`step.sleepUntil()` pauses the run until a date. `cancelOn` ends it early if a matching event
arrives while it waits.

```ts
cancelOn: [{ event: cardDeleted, match: "data.cardId" }],

await step.sleepUntil("wait-for-delivery-date", event.data.deliverAt);
```

The nightly cleanup is a cron trigger. A second, event trigger lets you run it now:

```ts
triggers: [{ cron: "TZ=America/New_York 0 3 * * *" }, cleanupRequested],
```

```sh
pnpm send 05 scheduled
pnpm send 05 delete-before-delivery
pnpm send 05 cleanup
```

`scheduled` delivers five seconds after it's sent. `delete-before-delivery` ends as Cancelled
with no mail. `cleanup` runs the draft cleanup without waiting for 3am.

## Watch it

In http://localhost:8288 the `schedule-delivery` run shows `wait-for-delivery-date` as a sleep with
its wake-up time. Send `card/deleted` and the run flips to Cancelled. The cleanup function lists
both triggers, and the cron's next run time, on its function page.

The ledger wall at http://localhost:3005 shows a delivery appear five seconds after `scheduled`, and
none after `delete-before-delivery`.

## In your app

Replace "scheduled_at" columns and the job that scans them with an event that carries the date
and a `sleepUntil`. Add `cancelOn` for every event that makes the scheduled work pointless, such
as deletion, unsubscribe or refund.

## Next

So far every card has been on its own. Tomorrow one account sends twenty at once.
