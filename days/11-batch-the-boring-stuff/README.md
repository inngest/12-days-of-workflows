# Day 11: Why am I paying for 120 writes that could be three?

## The problem

Every "card opened" event does its own warehouse insert, and the warehouse bills per write, not
per row. A popular card turns into a pile of one-row writes.

## Break it

```sh
pnpm day 11
pnpm send 11 opens-120-before
```

120 opens arrive over two seconds. Watch the `[warehouse]` lines: 120 inserts of `1 row`, each
`billed 1 write`.

## Fix it

Batch the events. The function waits until it has 50 opens, or until 5 seconds have passed, and
then runs once with all of them in `events`.

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

```sh
pnpm send 11 opens-120
```

Three inserts: 50 rows, 50 rows, then the last 20 once the 5-second timeout passes.

## Watch it

In http://localhost:8288 `record-opens` has three runs. Open one and its trigger shows a batch of
50 events instead of one.

The ledger wall at http://localhost:3011 counts warehouse writes and rows per write: 120 writes of 1
row, then 3 writes of up to 50.

## In your app

Batch writes to warehouses, analytics and anything else billed per call. Add a `key` to batch per
account. A batching function can't also use priority, cancellation events, rate limiting,
idempotency or debounce, so keep those on a separate function. Batch size limits depend on your
plan.

## Next

Everything so far has made cards cheaper and faster. Tomorrow: are they any good?
