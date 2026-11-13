# Day 07: Why are my retries making the rate limiting worse?

**Key idea:** `throttle` spaces out run starts, so you stay under a provider's rate limit instead
of bouncing off it.

## Problem

The image provider allows 5 calls per 10 seconds. A burst of cards fires every render at once,
most get a 429, and the retries pile onto the same wall.

## Break it

```sh
pnpm day 07
pnpm send 07 burst-before
```

Fifteen cards arrive at once. In the `[image]` lines, about five render and the rest are
`rate limited, free in … ms`. Each is a wasted call that will retry later.

Restart `pnpm day 07` before the fix, so leftover retries don't land in the next scenario.

## Fix it

Day 03 gave rendering its own function, so one run start is one image call. Throttle it a little
under the provider's limit, to leave headroom:

```ts
export const renderCardImage = inngest.createFunction(
  {
    id: "render-card-image",
    retries: 10,
    triggers: [invokedWithText],
    throttle: { limit: 4, period: "10s" },
  },
  async ({ event, step }) => step.run("render", () => renderImage({ text: event.data.text })),
);
```

```sh
pnpm send 07 burst
```

Throttled runs wait in a queue instead of failing. Every card is delivered in about 30 seconds,
with no 429s.

## Watch it

- Dev Server (http://localhost:8288): all fifteen `create-card` runs start and wait on
  `render-image`. The `render-card-image` runs start in small groups.
- Ledger wall (http://localhost:3007): image renders against 429s.

## In your app

Throttle limits how many runs **start** per period (Day 06 limited how many run at once). Put it
on a function that makes one provider call per run. Add a `key` to throttle per customer API key.

## Next

Some work shouldn't run once per event. Tomorrow the user types, and we wait for them to stop.
