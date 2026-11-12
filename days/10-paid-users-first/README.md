# Day 10: Why do my paying customers wait behind free users?

## The problem

Twenty free cards are queued up when two pro cards arrive. The queue is first come, first served,
so the people paying you go out last.

## Break it

```sh
IMAGE_RATE=off pnpm day 10
pnpm send 10 pro-arrives-late-before
```

Only two cards run at a time, so a queue forms. Watch the `[mail]` lines: free `f…` deliveries,
then `p1` and `p2` at the very end. `IMAGE_RATE=off` keeps the fake image rate limit out of the
way; leave it set for the fixed scenario too.

Both scenarios take about 33 seconds, because 22 cards run two at a time.

## Fix it

Give each run a priority. The expression is evaluated per run from the triggering event and
returns seconds: pro runs are treated as if they had been queued two minutes earlier.

```ts
concurrency: { limit: 2 },
priority: { run: "event.data.plan == 'pro' ? 120 : 0" },
```

```sh
pnpm send 10 pro-arrives-late
```

`p1` and `p2` arrive after the free cards but are delivered among the first few. Free cards keep
their order and still finish.

## Watch it

In http://localhost:8288, filter runs by `create-card`. Most free runs are queued, and as soon as a
slot opens the pro runs start ahead of them.

Prefer a friendlier view? `pnpm studio` (http://localhost:3100) follows this day, and its
problem/fix switch matches `pro-arrives-late-before` and `pro-arrives-late`.

## In your app

Priority only matters when something is queued, so pair it with a concurrency limit. Values range
from -600 to 600 seconds, and priority can't be combined with batching. To give each plan its own
queue instead, key queues are the alternative: see the priority vs key queues explainer video.
Key queues currently require Enterprise access, so they aren't part of this demo.

## Next

Tomorrow's problem: we're paying for 120 database writes that could be three.
