# Day 04: How do I wait two days for a "yes" without a polling loop?

## The problem

The sender should see the draft and approve it before the card goes out. Doing that by hand means
a status column, a cron job that polls it, and code to clean up drafts nobody approved.

## Break it

There's no `-before` today, because the broken version is all that extra infrastructure. Start the
day and send a card that nobody approves:

```sh
DRAFT_TTL=5s pnpm day 04   # a 5-second timeout instead of 48 hours
pnpm send 04 ignore
```

Five seconds later the draft quietly expires and nothing is sent.

## Fix it

`step.waitForEvent()` pauses the run until a matching event arrives or the timeout passes. While
it waits, nothing is running and nothing is polling.

```ts
const approval = await step.waitForEvent("wait-for-approval", {
  event: cardApproved,
  match: "data.cardId",
  timeout: process.env.DRAFT_TTL ?? "48h",
});
if (approval === null) {
  await step.run("expire-draft", () => drafts.expire(event.data.cardId));
  return { status: "expired" };
}
```

`match: "data.cardId"` means "an approval whose `data.cardId` equals this run's `data.cardId`".
On timeout you get `null`, so the expiry path is plain code.

```sh
pnpm send 04 approve
pnpm send 04 approve-wrong-card
```

`approve` sends the card, then `card/approved` for `c1` a few seconds later, and the card is
delivered. `approve-wrong-card` approves `c2`, so `c1` keeps waiting.

## Watch it

In http://localhost:8288 the `create-card` run sits on `wait-for-approval`. Send the approval and
watch it resume straight into `deliver`. Run `ignore` and the run ends with output
`{ "status": "expired" }` once the timeout passes.

## In your app

Anywhere you store "pending" state and poll for a change (approvals, email verification, payment
confirmation), send an event when the change happens and `waitForEvent` for it instead. The wait
only sees events sent after it starts, so send the approval after the draft is ready.

## Next

Waiting for a person is one kind of pause. Tomorrow we wait for a date, and cancel if plans change.
