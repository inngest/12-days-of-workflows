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
that apart from a network blip, so the run fails, waits, and tries again, and it will keep doing
that for minutes. The Dev Server shows it stuck in Running. Nobody tells the sender anything.

## Fix it

Tell Inngest the failure is permanent, and tell the sender once it's over:

```ts
// Permanent: stop now, no retries.
if (!verdict.ok) throw new NonRetriableError(`Rejected: ${verdict.reason}`);

// Failed for good (any reason): run a handler once, after the last attempt.
onFailure: async ({ event, error, step }) => {
  const card = event.data.event.data;
  await step.run("notify-sender", () => notifySender(card.cardId, error.message));
},
```

`onFailure` receives a failure event, so the original card lives at `event.data.event.data`.

```sh
pnpm send 02 grinch
```

`grinch` fails in seconds, and `[mail] notifySender c1 "Rejected: …"` appears once.

### One more: come back when the provider says

Some failures come with a deadline. When the AI provider answers 429 with "try again in 5
seconds", retry exactly then:

```ts
if (err instanceof ProviderError && err.status === 429) {
  throw new RetryAfterError("LLM rate limited", err.retryAfterMs ?? "1m", { cause: err });
}
```

```sh
pnpm send 02 llm-429
```

The LLM fails once, waits the 5 seconds it was told to, and bills on the second call. Without
`RetryAfterError`, the retry would wait for the default backoff (15 s or more).

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
