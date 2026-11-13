# Day 12: We changed the prompt. Is it actually better?

**Key idea:** run the two prompts as an experiment, and score each card when its recipient reacts.
The score is credited to the prompt that wrote the card.

## Problem

You rewrote the card prompt to sound warmer and shipped it. Nobody can say if recipients like it
more: the only signal, whether someone loved their card, arrives long after the run that wrote it.

## Break it

There is no `-before` scenario. The "before" is what most teams do: swap the prompt for everyone
and go by gut feel. Nothing records which prompt wrote which card.

## Fix it

An experiment splits cards between two prompts and remembers which one each run got:

```ts
const { result, variant, experimentRef } = await group.experiment("card-tone", {
  variants: {
    classic: () => step.run("write-classic", () => writeCard({ prompt, variant: "classic" })),
    warm: () => step.run("write-warm", () => writeCard({ prompt, variant: "warm" })),
  },
  select: experiment.weighted({ classic: 50, warm: 50 }),
});
```

Score what you know now. Hand what you'll learn later to a deferred scorer, tagged with the
variant:

```ts
await step.score("score-length", { name: "fits-on-card", value: result.text.length <= 280 });
defer("score-reaction", {
  function: reactionScorer,
  data: { cardId: event.data.cardId },
  experiment: experimentRef,
});
```

The scorer is a durable function that waits for the reaction, like Day 04's approval:

```ts
export const reactionScorer = createScorer(
  inngest,
  { id: "score-recipient-reaction", schema: z.object({ cardId: z.string() }) },
  async ({ step }) => {
    const reaction = await step.waitForEvent("wait-for-reaction", {
      event: cardReacted,
      timeout: process.env.REACTION_TTL ?? "7d",
      match: "data.cardId",
    });
    if (reaction === null) return null;
    return { name: "recipient-loved-it", value: reaction.data.loved };
  },
);
```

`scoreMiddleware()` from `inngest/experimental` must be on the client (see `client.ts`). Scoring
and experiments are beta.

```sh
pnpm day 12
pnpm send 12 experiment-40
```

`pnpm day 12` shortens the reaction window (`REACTION_TTL`) to 60 seconds. Forty cards go out,
split between `classic` and `warm`. Once they are delivered, every recipient reacts. In this
fake, warm cards are loved about 70% of the time and classic about 40%.

## Watch it

The comparison (variants side by side, love rate per prompt) shows up in **Inngest Cloud**. The
Dev Server doesn't display experiments or scores yet. Run against Cloud with keys from an Inngest
environment:

```sh
export INNGEST_SIGNING_KEY=signkey-… INNGEST_EVENT_KEY=…
pnpm day 12 --cloud
pnpm send 12 experiment-40 --cloud
```

`--cloud` connects over an outbound WebSocket, so your laptop needs no public URL. With the keys
set, `pnpm studio` sends to Cloud too.

Locally, the Dev Server (http://localhost:8288) shows forty `score-recipient-reaction` runs, each
waiting on `wait-for-reaction` until its reaction arrives. One beta quirk: after a deferred score
lands, the parent `create-card` run shows as Running with an empty trace, though the card was
delivered.

The ledger wall (http://localhost:3012) has **Request card c1**, **c1: Loved it** and **c1: Meh**
buttons, so you can play the recipient. React after the card is delivered.

## In your app

Pick the outcome first: a click, a reply, a resolved ticket. Score it where it happens with
`step.score()`, or later with `defer()` and a scorer. Pass `experimentRef` so the score counts
toward a variant, and keep experiment and score names stable: a new name starts a new metric.

## Next

That's twelve days.
