# Day 10: Why are paying customers waiting behind the free tier?

**Key idea:** `priority` lets important runs jump ahead of work that is already queued.

## Problem

When the queue backs up, everyone waits their turn. A paying customer's card sits behind twenty
free-tier cards that arrived a moment earlier.

## Break it

```sh
pnpm day 10
pnpm send 10 pro-arrives-late-before
```

`pnpm day 10` turns the image rate limit off, so only the queue matters.

Twenty free cards fill the queue (`concurrency: { limit: 2 }` keeps it from draining at once). Two
pro cards arrive two seconds later. In the `[mail]` lines, `p1` and `p2` are delivered last.

## Fix it

```ts
concurrency: { limit: 2 },
priority: { run: "event.data.plan == 'pro' ? 120 : 0" },
```

The expression returns seconds: a pro run is scheduled as if it arrived 120 seconds earlier, so
it jumps ahead of free runs queued in that window.

```sh
pnpm send 10 pro-arrives-late
```

`p1` and `p2` are among the first deliveries, and the free cards still go in order.

## Watch it

- Dev Server (http://localhost:8288): the pro runs start as soon as a slot opens, ahead of free
  runs queued before them.
- Ledger wall (http://localhost:3010): deliveries in order. `p1` and `p2` move from last to first.

## In your app

Priority only reorders work that is waiting, so it matters when a concurrency limit or throttle
makes a queue form. Values run from -600 to 600 seconds. Use positive values to boost: a negative
value delays a run even when the queue is empty.
<!-- TODO(human): link the priority vs key queues explainer video. -->

## Next

Some work is cheap per item and expensive per call. Tomorrow we bundle it.
