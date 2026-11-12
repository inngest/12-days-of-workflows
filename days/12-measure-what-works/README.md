# Day 12: We changed the prompt. Is it actually better?

## The problem

You rewrote the card prompt and shipped it. Now you have no idea whether recipients like the new
cards more, because the only signal, whether they react, shows up days after the run is over.

## Break it

There is no `-before` shot for this day. The "before" is the thing most teams do: ship the new
prompt to everyone, watch a dashboard for a week, and argue about whether the bump was the prompt
or the season. You can't tell, because nothing connects a card to the reaction it caused.

## Fix it

Split traffic between two tones, then score every card when its recipient reacts, crediting the
variant that wrote it.

```ts
const { result: card, variant, experimentRef } = await group.experiment("card-tone", {
  variants: {
    classic: () => step.run("write-classic", () => writeCard({ ...event.data, variant: "classic" })),
    warm: () => step.run("write-warm", () => writeCard({ ...event.data, variant: "warm" })),
  },
  select: experiment.weighted({ classic: 50, warm: 50 }),
});

await step.score("score-length", { name: "fits-on-card", value: card.text.length <= 280 });
defer("score-reaction", {
  function: reactionScorer,
  data: { cardId: event.data.cardId },
  experiment: experimentRef,
});
```

The scorer is its own function. It waits for the recipient's `card/reacted` event and returns a
score. The card's run does not wait: `defer` hands off and the run finishes.

```ts
export const reactionScorer = createScorer(
  inngest,
  { id: "score-recipient-reaction", schema: z.object({ cardId: z.string() }) },
  async ({ event, step }) => {
    const reaction = await step.waitForEvent("wait-for-reaction", { ... });
    if (!reaction) return null;
    return { name: "recipient-loved-it", value: reaction.data.loved };
  },
);
```

```sh
REACTION_TTL=15s pnpm day 12   # the reaction wait is 7d in production; 15 seconds for the video
pnpm send 12 experiment-40
```

The scenario sends 40 cards, waits until all 40 are written, then sends one `card/reacted` per
card. The fake recipients are deterministic: `warm` is loved about 70% of the time, `classic`
about 40%. Without `REACTION_TTL`, the scorers would wait the full seven days, so set it when you
start the day. A reaction that never arrives times out and the scorer returns `null`, which
records no score.

`experiment.weighted` picks a variant per run. If a recipient should always get the same tone,
use `experiment.bucket(event.data.cardId, ...)` instead.

## Watch it

In http://localhost:8288, open a `create-card` run: the `card-tone` group shows which variant ran,
and only that variant's `write-*` step appears. Open its `score-recipient-reaction` run to see
`wait-for-reaction` resolve. Every `[llm]` line in the terminal names the card and its variant.

The Dev Server shows runs and steps only. Scores and the per-tone comparison, how much more often
`warm` is loved than `classic`, are visible in Inngest Cloud only: open the app there to see
`recipient-loved-it` broken down by `card-tone`. `pnpm check 12` asserts only on runs and the
ledger, since scores can't be read back from the Dev Server.

One Dev Server quirk: in the run list, a `create-card` run can still show as running after it has
finished. The run detail is right; trust that.

## In your app

Name the outcome first (a click, a reply, a resolved ticket), then emit an event when it happens,
however late. Wrap the one decision you're testing in `group.experiment`, with each variant doing
real step work, and `defer` a scorer that waits for that event. Ship the winner by switching to
`experiment.fixed`.

## Next

That's the twelfth day. The bonus day asks what to do when the agent writes code: where does it
run? It needs Inngest Cloud, so read its heads-up first.
