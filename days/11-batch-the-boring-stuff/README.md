# Day 11: Why am I paying for 120 writes that could be three?

**Key idea:** `batchEvents` turns many small events into one run with a list of events.

## Problem

Every "card opened" event does its own warehouse insert, and the warehouse bills per write, not
per row.

## Break it

```sh
pnpm day 11
pnpm send 11 opens-120-before
```

120 opens arrive over two seconds. The `[warehouse]` lines show 120 inserts of `1 row`, each
`billed 1 write`.

## Fix it

```ts
export const recordOpens = inngest.createFunction(
  {
    id: "record-opens",
    triggers: [cardOpened],
    batchEvents: { maxSize: 50, timeout: "5s" },
  },
  async ({ events, step }) => {
    const opens = events.map((event) => event.data);
    return step.run("insert-opens", () => insertRows("card_opens", opens));
  },
);
```

The function waits for 50 opens or 5 seconds, then runs once with all of them in `events`.

```sh
pnpm send 11 opens-120
```

Three inserts: 50 rows, 50 rows, then the last 20 after the 5-second timeout.

## Watch it

- Dev Server (http://localhost:8288): `record-opens` has three runs. Open one and its trigger is a
  batch of 50 events.
- Ledger wall (http://localhost:3011): warehouse writes and rows per write, 120 writes of 1 row
  before and 3 writes after.

## In your app

Batch anything billed per call: warehouses, analytics, bulk APIs. Add a `key` to batch per
account. A batching function can't also use priority, cancellation, rate limiting, idempotency or
debounce, so keep those on a separate function. Batch size limits depend on your plan.

## Next

Everything so far made cards cheaper and faster. Tomorrow: are they any good?
