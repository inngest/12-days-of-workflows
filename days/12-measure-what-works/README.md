# Day 12: We changed the prompt. Is it actually better?

## The problem

You rewrote the card prompt to sound warmer and shipped it. Nobody can say whether recipients like
the new cards more, because the only signal, whether someone loved their card, shows up long after
the request that wrote it has finished.

## Break it

There's no `-before` scenario today. The "before" is what most teams do: swap the prompt for
everyone and go by gut feel. Nothing records which prompt wrote which card, so a later reaction
can't be credited to either one.

## Fix it

Three pieces. First, an experiment splits traffic between the two prompts and remembers which one
each run got:

```ts
const { prompt } = event.data;
const { result, variant, experimentRef } = await group.experiment("card-tone", {
  variants: {
    classic: () => step.run("write-classic", () => writeCard({ prompt, variant: "classic" })),
    warm: () => step.run("write-warm", () => writeCard({ prompt, variant: "warm" })),
  },
  select: experiment.weighted({ classic: 50, warm: 50 }),
});
```

Second, score what you know right away, and hand what you'll learn later to a deferred scorer,
tagged with the variant:

```ts
await step.score("score-length", { name: "fits-on-card", value: result.text.length <= 280 });
defer("score-reaction", {
  function: reactionScorer,
  data: { cardId: event.data.cardId },
  experiment: experimentRef,
});
```

Third, the scorer is a durable function that waits days for the recipient's reaction:

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

`match: "data.cardId"` pairs each reaction with the card this scorer was deferred for, just like
the approval on Day 04.

`step.score()` needs `scoreMiddleware()` from `inngest/experimental` on the client (see
`client.ts`). Scoring and experiments are beta APIs.

```sh
REACTION_TTL=60s pnpm day 12
pnpm send 12 experiment-40
```

Forty cards go out, split between `classic` and `warm`. Once they're delivered, every recipient
reacts, and each card's scorer records whether it was loved. In this fake, warm cards are loved
about 70% of the time and classic about 40%.

## Watch it

The comparison itself (variants side by side, love rate per tone) shows up in **Inngest Cloud**.
The Dev Server doesn't display experiments or scores yet; its Experiments and Scores pages say so.
To see it, run the day against Cloud with keys from an Inngest environment:

```sh
export INNGEST_SIGNING_KEY=signkey-… INNGEST_EVENT_KEY=…
REACTION_TTL=60s pnpm day 12 --cloud
pnpm send 12 experiment-40 --cloud
```

Then run `pnpm studio` in the same shell: with both keys set it sends to Cloud and shows a button
to open the runs page.

`--cloud` skips the Dev Server and connects the app to Inngest Cloud with `connect()` over an
outbound WebSocket, so your laptop needs no public URL. The ledger wall stays on localhost.

Locally, http://localhost:8288 shows the forty `score-recipient-reaction` runs: each one starts
from `inngest/deferred.schedule`, waits on `wait-for-reaction`, and completes when its reaction
arrives. One beta quirk: once a deferred score lands, the Dev Server shows the parent
`create-card` run as Running with an empty trace. The run did finish, and the card was delivered.

The ledger wall at http://localhost:3012 has **Request card c1**, **c1: Loved it** and **c1: Meh**
buttons, so you can play the recipient yourself. React after the card is delivered.

## In your app

Pick the outcome before the experiment: a click, a reply, a resolved ticket. Score it where it
happens with `step.score()`, or later with a scorer and `defer()`. Pass `experimentRef` whenever a
score should count toward a variant, and keep experiment and score names stable, because changing
a name starts a new metric.

## Next

That's twelve days. Next up: putting all twelve together in one app.
