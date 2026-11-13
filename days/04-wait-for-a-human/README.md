# Day 04: How do I wait two days for a "yes" without a polling loop?

**Key idea:** `step.waitForEvent()` pauses a run until the event you need arrives or time runs
out. Nothing polls.

## Problem

The sender should approve the draft before the card goes out. By hand that means a status
column, a cron job to poll it, and cleanup for drafts nobody approved.

## Break it

```sh
pnpm day 04
pnpm send 04 approve-before
```

`pnpm day 04` sets a 15-second approval window (`DRAFT_TTL`) instead of 48 hours. Without an
approval step, the card is delivered before anyone sees the draft: watch the `[mail]` line.

## Fix it

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

`match` pairs the approval with this card. A timeout gives you `null`, so expiry is plain code.

```sh
pnpm send 04 approve
pnpm send 04 ignore
pnpm send 04 approve-wrong-card
```

- `approve`: the approval arrives and the card is delivered.
- `ignore`: nobody approves, and after 15 seconds the draft expires with nothing sent.
- `approve-wrong-card`: approves `c2`, so `c1` keeps waiting until it expires.

## Watch it

- Dev Server (http://localhost:8288): `create-card` sits on `wait-for-approval`, then resumes into
  `deliver`. After `ignore` it ends with `{ "status": "expired" }`.
- Studio (`pnpm studio`, http://localhost:3100/day/04): play the sender with **Approve the card**.
  Wait for the image first.
- Ledger wall (http://localhost:3004): the same **Request card c1** and **Approve c1** buttons.

## In your app

Wherever you store "pending" and poll for a change (approvals, email verification, payment), send
an event when it happens and wait for it instead. The wait only sees events sent after it starts.

## Next

Waiting for a person is one kind of pause. Tomorrow we wait for a date, and cancel if plans change.
