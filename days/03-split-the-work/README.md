# Day 03: Why does my flakiest API decide when the whole card gives up?

**Key idea:** give the flaky step its own function with its own retries, and call it with
`step.invoke()`.

## Problem

Text, image and delivery share one retry budget. The image service needs more patience than the
rest, and when it runs out the whole card fails.

## Break it

```sh
pnpm day 03
pnpm send 03 very-flaky-image-before
```

The image service fails five times. The default is four retries, so the run fails and the card
is never delivered.

## Fix it

```ts
export const renderCardImage = inngest.createFunction(
  { id: "render-card-image", retries: 10, triggers: [invokedWithText] },
  async ({ event, step }) => step.run("render", () => renderImage({ text: event.data.text })),
);

const image = await step.invoke("render-image", {
  function: renderCardImage,
  data: { text: card.text },
});
```

The parent waits for the child as if it were a step. `invokedWithText` (in `events.ts`) marks
the function as invoke-only and types `event.data`.

```sh
pnpm send 03 very-flaky-image
```

The same five failures happen inside `render-card-image`, which succeeds on the sixth try. The LLM
still bills once.

## Watch it

- Dev Server (http://localhost:8288): two runs. `create-card` waits on `render-image` while
  `render-card-image` retries. Click through from the parent step to the child run.
- Ledger wall (http://localhost:3003): image failures, and whether the card was delivered.

## In your app

When one dependency needs different retries, timeouts or concurrency, move it into its own
function. Pass the function itself to `step.invoke()` (or `referenceFunction()` for another app),
never a string id.

## Next

Not every wait is a retry. Tomorrow the card waits for a human.
