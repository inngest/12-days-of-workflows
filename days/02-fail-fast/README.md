# Day 02: Why is my app still retrying a card that can never work?

## The problem

Some failures are permanent: a rejected prompt will be rejected on the tenth try too. Others come
with instructions, like an LLM that says "slow down, try again in 5 seconds", and guessing your own
retry delay wastes either time or money.

## Break it

```sh
pnpm day 02
pnpm send 02 grinch-before
```

The prompt mentions the Grinch, so moderation rejects it with a plain `Error`. Inngest can't tell
that apart from a network blip, so the `[app]` log shows `[moderation] checkPrompt c1 rejected`
again and again as the run retries for minutes. Nobody tells the sender anything.

## Fix it

Three tools, one per kind of failure:

```ts
// Permanent: stop now, no retries.
if (!verdict.ok) throw new NonRetriableError(`Rejected: ${verdict.reason}`);

// Temporary, with a deadline: retry exactly when the provider says.
if (err instanceof ProviderError && err.status === 429) {
  throw new RetryAfterError("LLM rate limited", err.retryAfterMs ?? "1m", { cause: err });
}

// Failed for good (any reason): run a handler once, after the last attempt.
onFailure: async ({ event, error, step }) => {
  await step.run("notify-sender", () =>
    notifySender(event.data.event.data.cardId, error.message),
  );
},
```

`onFailure` receives a failure event, so the original trigger lives at `event.data.event`.

```sh
pnpm send 02 grinch
pnpm send 02 llm-429
```

`grinch` fails in seconds and `[mail] notifySender c1 "Rejected: …"` appears once. `llm-429`
fails the LLM once with a 429, waits the 5 seconds the provider asked for, and bills on the second
call. Without `RetryAfterError`, the retry would wait for the default backoff (15 s or more).

## Watch it

In http://localhost:8288, the `grinch` run is marked Failed after a single `moderate` attempt, and
a separate `create-card` failure-handler run holds the `notify-sender` step. In the `llm-429` run,
`write-text` shows one failed attempt, then a gap of about five seconds before the retry.

The ledger wall at http://localhost:3002 shows the Grinch card with zero LLM calls and one sender
notice.

## In your app

Find the places where you already know an error is final (validation, 4xx, "not found") and throw
`NonRetriableError` there. Where an API returns `Retry-After`, pass it into `RetryAfterError`.
Then add `onFailure` to anything a human is waiting on.

## Next

One flaky dependency is still setting the retry policy for the whole card. Tomorrow we split it out.
