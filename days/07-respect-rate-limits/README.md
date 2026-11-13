# Day 07: Why are my retries making the rate limiting worse?

## The problem

The image provider allows 5 calls every 10 seconds. A burst of cards fires every render at once,
most of them bounce off with a 429, and the retries pile onto the same wall.

## Break it

```sh
pnpm day 07
pnpm send 07 burst-before
```

Fifteen cards arrive at once. Watch the `[image]` lines: about five render, and the rest
get `rate limited, free in … ms`. Every one of those is a wasted call, and each will retry later on
the normal backoff, only to compete with whatever else is rendering.

Before the fix, stop `pnpm day 07` and start it again. The leftover retries would otherwise land
in the middle of the next scenario.

## Fix it

Throttle the function that calls the provider. Day 03 already gave rendering its own function, so
one run start means one image call. Set the throttle a little under the provider's limit: run
starts and the provider's own clock never line up exactly, and the headroom absorbs the difference.

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

Throttled runs wait in a queue instead of failing. Renders start a few at a time and every card is
delivered in about half a minute.

## Watch it

In http://localhost:8288, all fifteen `create-card` runs start right away and sit on their
`render-image` step. The `render-card-image` runs start in small groups, spread over the window.

The ledger wall at http://localhost:3007 counts image renders against 429s: a wall of red before,
zero after.

## In your app

Throttle limits how many runs **start** per period (Day 06 limited how many run at once). Put it on
a function that makes one provider call per run, and add a `key` to throttle per customer API key.

## Next

Some work shouldn't run once per event at all. Tomorrow the user types and we wait for them to stop.
