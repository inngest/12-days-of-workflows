# Day 01: Why did one flaky API bill me three times?

**Key idea:** wrap each side effect in `step.run()`. A step that succeeded is saved, so a retry
skips it.

## Problem

Your card needs LLM text, a rendered image and an email. When the image service hiccups, the whole
function reruns, and you pay for the LLM text again.

## Break it

```sh
pnpm day 01
pnpm send 01 flaky-image-before
```

The image service fails twice. In the `[app]` log, `[llm] writeCard c1 billed …` appears three
times, once per retry.

## Fix it

```ts
const card = await step.run("write-text", () => writeCard(event.data));
const image = await step.run("render-image", () => renderImage({ text: card.text }));
await step.run("deliver", () => sendCard(event.data));
```

```sh
pnpm send 01 flaky-image
```

Same two failures, but the LLM bills once (`call #1` only). Only `render-image` runs again.

## Watch it

- Dev Server (http://localhost:8288): `create-card` shows `write-text` once, `render-image` failing
  twice, then `deliver`. `create-card-before` is one block, retried.
- Ledger wall (http://localhost:3001): LLM calls per card, 3.0 before and 1.0 after.

## In your app

Give each external call its own step, with a short verb-first id. Never wrap a whole loop in one
step: Day 09 shows why.

## Next

Some failures never succeed, however often you retry. Tomorrow we stop retrying them.
