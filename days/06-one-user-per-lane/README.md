# Day 06: Why does one busy account make everyone else wait?

## The problem

One account sends a burst of cards. They take every slot your workers have, so the next customer's
single card waits in line behind all of them.

## Break it

```sh
IMAGE_RATE=off pnpm day 06
pnpm send 06 noisy-neighbor-before
```

`IMAGE_RATE=off` turns off the fake image service's rate limit (Day 07's topic), so only
concurrency shapes this demo. Keep it set for the fixed scenario too.

Account `a` sends 20 cards, then account `b` sends one. With a single lane of 5, `b1` is one of
the last cards delivered. Watch the `[mail]` lines: most of the `a…` deliveries, then `b1`.

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
through its burst two at a time. The whole burst takes about 30 seconds, because two cards at a
time is slow on purpose.

## Watch it

In http://localhost:8288, filter runs by `create-card`. During the burst, only two `a` runs are
active at once and the rest are queued. `b1` goes straight to running.

Prefer a friendlier view? `pnpm studio` (http://localhost:3100) follows this day, and its
problem/fix switch matches `noisy-neighbor-before` and `noisy-neighbor`.

## In your app

Key concurrency by whatever your customers share capacity across: account, workspace, API key.
Keep a total limit too, so many accounts at once can't overwhelm the provider. A function can have
up to two concurrency constraints.

## Next

Tomorrow's problem: the image API is rate-limiting us and our retries are making it worse.
