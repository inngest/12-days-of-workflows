# Day 06: Why does one busy account make everyone else wait?

**Key idea:** a concurrency limit with a `key` gives each account its own lane.

## Problem

One account sends a burst of cards and takes every slot. The next customer's single card waits
behind all of them.

## Break it

```sh
pnpm day 06
pnpm send 06 noisy-neighbor-before
```

`pnpm day 06` turns the image rate limit off, because rate limits are Day 07's lesson.

Account `a` sends 20 cards, then `b` sends one. With one shared lane of 5, `b1` is among the last
`[mail]` lines.

## Fix it

```ts
concurrency: [
  { limit: 5 }, // total capacity
  { key: "event.data.accountId", limit: 2 },
],
```

The total stays at 5, but no account can hold more than 2 slots.

```sh
pnpm send 06 noisy-neighbor
```

`b1` starts as soon as it arrives and is among the first deliveries.

## Watch it

- Dev Server (http://localhost:8288): during the burst only two `a` runs are active and the rest
  queue. `b1` goes straight to running.
- Ledger wall (http://localhost:3006): deliveries in order. Find `b1` before and after.

## In your app

Key concurrency by whatever customers share capacity across: account, workspace, API key. Keep a
total limit too, so many accounts at once can't overwhelm a provider. A function can have up to two
concurrency limits.

## Next

Concurrency limits how much runs at once. Tomorrow the provider limits how much runs per second.
