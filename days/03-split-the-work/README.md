# Day 03: Why does my flakiest API decide when the whole card gives up?

## The problem

Text, image and delivery all live in one function, so they share one retry budget. The image
service needs more patience than the others, and when it runs out, the whole card fails with it.

## Break it

```sh
pnpm day 03
pnpm send 03 very-flaky-image-before
```

The image service fails five times in a row. The step retries four times (the default), then the
run fails and the card is never delivered. The fake service asks Inngest to retry after one
second, so this takes seconds. Normal backoff spreads the same retries over several minutes.

## Fix it

Give rendering its own function with its own retry policy, and call it with `step.invoke()`. The
parent waits for the child's result as if it were a step.

```ts
export const renderCardImage = inngest.createFunction(
  { id: "render-card-image", retries: 10, triggers: [imageRequested] },
  async ({ event, step }) => step.run("render", () => renderImage({ text: event.data.text })),
);

const image = await step.invoke("render-image", {
  function: renderCardImage,
  data: { text: card.text },
});
```

`imageRequested` is `invoke(staticSchema<{ text: string }>())` in `events.ts`. It marks the
function as invoke-only and types `event.data` for both sides of the call.

```sh
pnpm send 03 very-flaky-image
```

The same five failures happen inside `render-card-image`, which keeps going and succeeds on the
sixth try. The LLM still bills once.

## Watch it

http://localhost:8288 shows two runs: `create-card` sits on its `render-image` step while the
`render-card-image` run retries. Click through from the parent's step to the child run.

The ledger wall at http://localhost:3003 counts the image failures and shows whether the card was
delivered.

## In your app

When one dependency needs different retries, timeouts or concurrency than the rest, move it into
its own function and `step.invoke()` it. Pass the function itself (or `referenceFunction()` for a
function in another app), never a string id.

## Next

Not every wait is a retry. Tomorrow the card waits for a human to say yes.
