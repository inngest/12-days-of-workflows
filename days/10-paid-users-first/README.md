# Day 10: Why are paying customers waiting behind the free tier?

## The problem

When the queue backs up, everyone waits their turn. A customer on the paid plan sends a card and
watches it sit behind twenty free-tier cards that arrived a moment earlier.

## Break it

```sh
IMAGE_RATE=off pnpm day 10
pnpm send 10 pro-arrives-late-before
```

`IMAGE_RATE=off` turns off the image service's rate limit (Day 07), so only the queue matters.

Twenty free cards fill the queue (`concurrency: { limit: 2 }` keeps it from draining instantly).
Two pro cards arrive two seconds later. Watch the `[mail]` lines: `p1` and `p2` are delivered
last.

## Fix it

Give pro runs a priority. The expression returns seconds: a pro run is scheduled as if it had
arrived up to 120 seconds earlier, so it jumps ahead of free runs queued in that window.

```ts
concurrency: { limit: 2 },
priority: { run: "event.data.plan == 'pro' ? 120 : 0" },
```

```sh
pnpm send 10 pro-arrives-late
```

`p1` and `p2` are among the first few cards delivered, while the free cards keep going in order.

## Watch it

In http://localhost:8288, filter runs by `create-card`. The pro runs start as soon as a slot opens,
ahead of free runs that were queued before them.

The ledger wall at http://localhost:3010 lists deliveries in order. Find `p1` and `p2` at the end,
then near the start.

## In your app

Priority only reorders work that is waiting, so it matters when a concurrency limit or throttle
makes a queue form. It goes from -600 to 600 seconds. Use positive values to boost: a negative
value delays a run even when the queue is empty. Key queues are the next step up, separating
tenants into their own queues. That's an Enterprise feature, so it's covered in the explainer
video rather than this demo.
<!-- TODO(human): link the priority vs key queues explainer video. -->

## Next

Some work is cheap per item and expensive per call. Tomorrow we bundle it.
