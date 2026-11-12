# Day 09: How do I send a card to everyone without sending it twice?

## The problem

One card, 50 recipients, one loop. Recipient 25 hits a mail failure, the step retries, and the
loop starts over from recipient 1. The first 24 people get the card twice.

## Break it

```sh
pnpm day 09
pnpm send 09 bulk-50-before
```

This is the loop-in-one-step anti-pattern: a single `step.run()` wraps the whole `for` loop, so
Inngest can only retry the whole loop. Watch the terminal: `guest1@example.com` through
`guest24@example.com` are delivered, then delivered again. The fake mailer asks for a retry after
one second, so this takes seconds. Normal backoff would spread it over minutes.

## Fix it

Fan out. The parent sends one event per recipient with `step.sendEvent()`, and a second function,
`deliver-card`, handles each event in its own run.

```ts
await step.sendEvent(
  "send-deliveries",
  event.data.recipients.map((to) => cardDeliver.create({ cardId: event.data.cardId, to })),
);
```

```ts
export const deliverCard = inngest.createFunction(
  { id: "deliver-card", triggers: [cardDeliver] },
  async ({ event, step }) =>
    step.run("deliver", () => sendCard({ to: event.data.to, cardId: event.data.cardId })),
);
```

```sh
pnpm send 09 bulk-50
```

Same failure at recipient 25, but now it only fails one tiny run. That run retries by itself and
the other 49 are untouched: 51 mail calls in total, nobody twice.

## Watch it

http://localhost:8288 shows one `bulk-send` run and 50 `deliver-card` runs. Find the one with two
attempts on its `deliver` step.

Prefer a friendlier view? `pnpm studio` (http://localhost:3100) follows this day, and its
problem/fix switch matches `bulk-50-before` and `bulk-50`.

## In your app

Whenever you loop over a list and each item has a side effect, make each item its own run. If the
parent needs the results back, call `step.invoke()` for each recipient inside `Promise.all()`
instead (see Day 03). Use `step.sendEvent()` when the parent doesn't need to wait.

## Next

Tomorrow's problem: paying customers are stuck behind free-tier traffic.
