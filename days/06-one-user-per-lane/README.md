# Day 06: Why does one busy account make everyone else wait?

## The problem

One account sends a burst of cards. They take every slot your workers have, so the next customer's
single card waits in line behind all of them.

## Break it

```sh
IMAGE_RATE=off pnpm day 06
pnpm send 06 noisy-neighbor-before
```

Account `a` sends 20 cards, then account `b` sends one. With a single lane of 5, `b1` is one of
the last cards delivered. Watch the `[mail]` lines: twenty `a…` deliveries, then `b1`.

## Fix it

Add a second concurrency limit keyed by account. The total stays at 5, but no single account can
hold more than 2 of those slots.

```ts
concurrency: [
  { limit: 5 }, // total capacity
  { key: "event.data.accountId", limit: 2 },
],
```

```sh
pnpm send 06 noisy-neighbor
```

`b1` now starts as soon as it arrives and is among the first few deliveries, while `a` works
through its burst two at a time.

## Watch it

In http://localhost:8288, filter runs by `create-card`. During the burst, only two `a` runs are
active at once and the rest are queued. `b1` goes straight to running.

The ledger wall at http://localhost:3006 lists deliveries in order. Watch where `b1` lands with and
without the per-account lane.

## In your app

Key concurrency by whatever your customers share capacity across: account, workspace, API key.
Keep a total limit too, so many accounts at once can't overwhelm the provider. A function can have
up to two concurrency constraints.

## Next

Concurrency limits how much runs at once. Tomorrow the provider limits how much runs per second.
