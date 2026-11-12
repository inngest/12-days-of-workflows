# Day 11: How do I stop paying for 120 database writes that could be three?

## The problem

Every "card opened" event runs its own function and does its own warehouse insert. You pay per
write, and 120 opens means 120 writes.

## Break it

```sh
pnpm day 11
pnpm send 11 opens-120-before
```

The terminal fills with `insertRows card_opens 1 rows, billed 1 write`, 120 times.

## Fix it

Batch the events. Inngest collects up to 50 of them, or whatever arrives in 5 seconds, and starts
one run with all of them in `events`.

```ts
batchEvents: { maxSize: 50, timeout: "5s" },
```

```ts
async ({ events, step }) =>
  step.run("insert-opens", () => insertRows("card_opens", events.map((e) => e.data))),
```

```sh
pnpm send 11 opens-120
```

120 events arrive over about two seconds. The first 50 fill a batch, the next 50 fill another, and
the last 20 wait for the 5-second timeout: three writes (50, 50, 20) instead of 120.

## Watch it

http://localhost:8288 shows three `record-opens` runs instead of 120. Open one and look at its
event: it holds the whole batch.

Prefer a friendlier view? `pnpm studio` (http://localhost:3100) follows this day, and its
problem/fix switch matches `opens-120-before` and `opens-120`.

## In your app

Batching trades latency for cost: an event can wait up to `timeout` before anything runs. Use it
for writes that don't need to be instant, like analytics, logs and bulk API calls. Use `key` to
batch per account. A batched function can't also use priority, cancellation events, rate
limiting, idempotency or debounce. Put work that needs those in a separate function.

## Next

Tomorrow's problem: we changed the prompt. Is it actually better?
