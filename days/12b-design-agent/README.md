# Day 12b: The agent writes code. Where does it run?

> **Heads up: Sandboxes are an open beta, an experimental API (`inngest/experimental`), and
> Cloud-only (Pro plan or above).** The local Dev Server cannot run them: the `render-card` step
> fails fast and asks you to `inngest login`. The rest of this series runs locally; this bonus day
> needs an Inngest Cloud account.

## The problem

A card-designer agent writes each card as code, a few lines of TypeScript that draw an SVG. Running
code an LLM just wrote inside your own server is a bad idea: it can throw, hang or do anything.
And once it runs, "did it work?" is only half the question. The other half is whether the
recipient loved the card.

## Break it

There is no `-before` scenario. The naive version is the one you'd write first: `eval` or
`import` the generated code inside your own process and hope. One bad card can throw, hang the
event loop, or touch anything on the server.

## Fix it

Run the generated code in an Inngest Sandbox, a throwaway microVM, instead of on our servers.
`step.sandbox.typescript` creates one, runs the code, validates the result against a schema, and
destroys it.

```ts
let renders = true;
try {
  await step.sandbox.typescript("render-card", card.code, {
    input: { message: event.data.prompt },
    schema: { output: z.object({ svg: z.string() }) },
    timeout: "20s",
  });
} catch (error) {
  if (getSandboxError(error)) throw error; // the sandbox itself failed: not the card's fault
  renders = false;
}
await step.score("score-renders", { name: "card-renders", value: renders });
```

Broken code makes the step fail. Catching that turns a crash into a number: `card-renders` is
`false`, the run still completes. About a quarter of the fake agent's cards are broken on purpose
(some throw, some are a syntax error), so the score visibly varies. A second, deferred scorer
(the same one as Day 12) waits for the recipient's `card/reacted` and records
`recipient-loved-it`.

The client needs the Sandbox middleware next to the scoring one:

```ts
middleware: [chaosMiddleware, scoreMiddleware(), sandboxMiddleware()],
```

Both come from `inngest/experimental` and need `inngest@^4.21.1`.

### Run it (Inngest Cloud required)

Sandboxes live in Inngest Cloud, so something has to be connected to it. Without that, the
`render-card` step fails immediately with `cloud_login_required`, and every card scores
`card-renders = false`. Two ways to connect:

1. **Local app, Cloud sandboxes.** Log the Dev Server in to your Cloud account (the error message
   suggests `inngest login`; see the [CLI docs](https://www.inngest.com/docs/cli)), then start the
   day with a short reaction wait and send the scenario. `REACTION_TTL` is 7 days by default:

   ```sh
   REACTION_TTL=20s pnpm day 12b
   pnpm send 12b render-20
   ```

2. **Everything on Cloud.** Run the app without the Dev Server and sync it to a Cloud environment on
   a Pro plan. Never commit keys; set them in your shell:

   ```sh
   export INNGEST_SIGNING_KEY=...   # your environment's signing key
   export INNGEST_EVENT_KEY=...     # to send events
   PORT=3013 pnpm --filter @12days/day-12b exec tsx src/index.ts
   ```

   Then sync `http://<your-public-url>:3013/api/inngest` in the Cloud dashboard. Put
   `REACTION_TTL=20s` in front of the `PORT=3013` command so the reaction wait is short.

`render-20` sends 20 cards, waits for the agent to write them, then sends one `card/reacted` per
card. `pnpm check 12b` always typechecks and checks the lesson budget; it runs `render-20` only
when `SANDBOX_CLOUD=1` is set (`SANDBOX_CLOUD=1 pnpm check 12b`), because nothing about it can
pass without Cloud. `pnpm send` itself does not look at `SANDBOX_CLOUD`.

## Watch it

In your Cloud dashboard, open a `create-card` run: `write-card-code`, then `render-card` with the
Sandbox's activity in the trace, then `score-renders`. Scores (`card-renders`,
`recipient-loved-it`) are Cloud features too.

## In your app

Anywhere an LLM produces something executable (code, queries, scripts), run it in a sandbox and
score whether it ran. Create sandboxes through the one-call runners when you can: they clean up
after themselves. With the lower-level `step.sandbox.create`, destroying the sandbox after a
permanent failure is your job.

## Next

That's the end of the series. Your workflows now survive failure, wait for people and dates, keep
fair and fast under load, run untrusted code safely, and tell you whether they're any good.
