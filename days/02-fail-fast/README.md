# Day 02: Why is my app still retrying a card that can never work?

**Key idea:** throw `NonRetriableError` for failures that can't succeed, and use `onFailure` to
tell someone.

## Problem

A card the moderator rejects will be rejected on the tenth try too. Retrying wastes money, and
nobody tells the sender.

## Break it

```sh
pnpm day 02
pnpm send 02 grinch-before
```

The prompt mentions the Grinch, so moderation throws a plain `Error`. Inngest can't tell it from
a network blip, so it keeps retrying. The sender hears nothing.

## Fix it

```ts
if (!verdict.ok) throw new NonRetriableError(`Rejected: ${verdict.reason}`);

onFailure: async ({ event, error, step }) => {
  const card = event.data.event.data;
  await step.run("notify-sender", () => notifySender(card.cardId, error.message));
},
```

`onFailure` gets a failure event, so the original card is at `event.data.event.data`.

```sh
pnpm send 02 grinch
```

The run fails in seconds, and `[mail] notifySender c1 "Rejected: …"` appears once.

## Watch it

- Dev Server (http://localhost:8288): the run is Failed after one `moderate` attempt, and a
  separate failure-handler run holds `notify-sender`.
- Ledger wall (http://localhost:3002): the card has zero LLM calls and one sender notice.

## In your app

Throw `NonRetriableError` where you know an error is final (validation, 4xx, not found). Add
`onFailure` to anything a person is waiting on.

## Next

One flaky dependency still sets the retry policy for the whole card. Tomorrow we split it out.
