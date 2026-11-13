# Day 09: Why did half my list get the card twice?

**Key idea:** never loop over side effects inside one step. Fan out: one event, and one run, per
recipient.

## Problem

Sending one card to 50 people is a loop. When delivery #25 fails and the job retries, the loop
starts over and the first 24 people get the card again.

## Break it

```sh
pnpm day 09
pnpm send 09 bulk-50-before
```

`send-to-everyone-before` puts the whole `for` loop in one `step.run`. A step is the unit of
retry, so one failure retries all 50. In the `[mail]` lines, `friend1` to `friend24` arrive twice.

## Fix it

```ts
const { cardId, recipients } = event.data;
const deliveries = recipients.map((to) => deliveryRequested.create({ cardId, to }));
await step.sendEvent("fan-out", deliveries);

export const deliverCard = inngest.createFunction(
  { id: "deliver-card", triggers: [deliveryRequested] },
  async ({ event, step }) => step.run("deliver", () => sendCard(event.data)),
);
```

```sh
pnpm send 09 bulk-50
```

Fifty `deliver-card` runs. Only the failed one retries, and everyone gets exactly one card.

## Watch it

- Dev Server (http://localhost:8288): `send-to-everyone` finishes at once with `{ queued: 50 }`,
  and fifty `deliver-card` runs fan out beside it. One shows a failed attempt and a retry.
- Ledger wall (http://localhost:3009): all 50 deliveries, with double sends in red.

## In your app

One step per side effect. If the parent needs each child's result, use `step.invoke()` per
recipient inside `Promise.all` (Day 03). Fan-out runs in parallel, so pair it with concurrency or
throttling (Days 06 and 07) for providers with limits.

## Next

The queue is moving. Tomorrow we decide who goes first.
