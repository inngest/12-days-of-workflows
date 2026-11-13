# Day 01: Why did one flaky API bill me three times?

## The problem

Your card needs text from an LLM, an image from a render service, and an email. When the image
service hiccups, the whole request dies, and the retry pays for the LLM text all over again.

## Break it

```sh
pnpm day 01
pnpm send 01 flaky-image-before
```

The image service fails twice. Watch the `[app]` log: `[llm] writeCard c1 billed …` shows up
three times (`call #1`, `#2`, `#3`), once per retry, because the whole function reruns from the top.
The fake service asks Inngest to retry after one second, so the demo is quick. Normal backoff spreads
retries over minutes.

## Fix it

Wrap each side effect in `step.run()`. A step that succeeds is saved, and a retry skips it and
reuses its result. Only the failed step runs again.

```ts
const card = await step.run("write-text", () => writeCard(event.data));

const image = await step.run("render-image", () => renderImage({ text: card.text }));

await step.run("deliver", () => sendCard(event.data));
```

```sh
pnpm send 01 flaky-image
```

Same two image failures, but the LLM bills once (`call #1` only) and `renderImage` runs three times.

> **Loop vs step.** Use one step per side effect. Never wrap a whole loop in a single step: if
> item 37 fails, the retry redoes items 1–36 as well. Put the step inside the loop, with an id
> per item, so each item is saved on its own. (Day 09 comes back to this.)

## Watch it

Open http://localhost:8288 and click the `create-card` run. The timeline shows `write-text`
finishing once, `render-image` failing twice with retry attempts, then succeeding, then `deliver`.
Compare it with the `create-card-before` run, which is one opaque block retried three times.

The ledger wall at http://localhost:3001 keeps score: LLM calls per card reads 3.0 before the fix
and 1.0 after.

## In your app

Find a handler that calls more than one external service. Move it into an Inngest function and
give each call its own `step.run()` with a short, verb-first id. Each step's return value must be
JSON-serializable, because Inngest stores it.

## Next

Some failures will never succeed, however many times you retry. Tomorrow we stop retrying them.
