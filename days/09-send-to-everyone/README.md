# Day 09: Why did half my list get the card twice?

## The problem

Sending one card to 50 people is a loop. When delivery #25 fails and the job retries, it starts
the loop again, and the first 24 people get the card a second time.

## Break it

```sh
pnpm day 09
pnpm send 09 bulk-50-before
```

`bulk-send-before` wraps the whole `for` loop in a single `step.run`. This is the loop-inside-a-step
anti-pattern: a step is the unit of retry, so one failed send retries all 50. Watch the `[mail]`
lines: `friend1` through `friend24` are delivered twice. The fake mailer asks Inngest to retry
after one second, so the demo is quick. Normal backoff would wait longer.

## Fix it

Fan out. The parent sends one event per recipient, and a second function delivers each one in its
own run, with its own retries.

```ts
await step.sendEvent(
  "fan-out",
  event.data.recipients.map((to) => cardDeliver.create({ cardId: event.data.cardId, to })),
);

export const deliverCard = inngest.createFunction(
  { id: "deliver-card", triggers: [cardDeliver] },
  async ({ event, step }) =>
    step.run("deliver", () => sendCard({ to: event.data.to, cardId: event.data.cardId })),
);
```

```sh
pnpm send 09 bulk-50
```

Fifty `deliver-card` runs. Only the failed delivery retries, and every recipient gets exactly one card.

## Watch it

In http://localhost:8288 `bulk-send` finishes almost immediately with `{ queued: 50 }`. Fifty
`deliver-card` runs fan out beside it. One shows a failed attempt and a retry.

The ledger wall at http://localhost:3009 shows all 50 deliveries in order, with anyone who got the
card twice in red.

## In your app

One step per side effect: never put a loop of side effects inside one `step.run`. If the parent
needs every child's result, use `step.invoke()` per recipient inside `Promise.all` instead (Day 03).
Fan-out runs in parallel, so pair it with concurrency or throttling (Days 06–07) for providers
with limits. Checkpointing, on by default in v4, keeps runs with many steps fast without any changes.

## Next

The queue is moving now. Tomorrow we decide who gets to go first.
