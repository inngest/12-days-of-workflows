# Day 12b: Can the agent design the card, safely?

## The problem

You let an AI agent design each holiday card as code, and the code has to run somewhere. Running
it on your own servers is risky, and nothing tells you whether one kind of design works better
than another.

## Break it

There's no `-before` scenario. The naive version asks the model for a program and runs it right
inside your app, so one bad design can crash the worker, hang it, or touch things it shouldn't.
It also records nothing about which style of design broke and which didn't, so "bold looks great"
and "bold keeps failing" are both just opinions.

## Fix it

Three ideas: the agent is the brain, the sandbox is the hands, and durable execution keeps score.

The brain: an experiment splits cards between two design styles, and each style asks the agent
(a fake here) for a small Node program that prints the card as SVG:

```ts
const { result, variant, experimentRef } = await group.experiment("design-prompt", {
  variants: {
    classic: () => step.run("design-classic", () => designCard({ prompt, variant: "classic" })),
    bold: () => step.run("design-bold", () => designCard({ prompt, variant: "bold" })),
  },
  select: experiment.weighted({ classic: 50, bold: 50 }),
});
```

The hands: the program runs in an Inngest Sandbox, a throwaway VM in Inngest Cloud, instead of on
your servers. A crash comes back as data (`exitCode`, `stderr`), not as an exception:

```ts
const sandbox = await step.sandbox.create("create-renderer", {
  name: `card-${cardId}`,
  vcpu: 1,
  memoryMb: 1024,
});
const first = await sandbox.commands.run("render-card", ["node", "-e", result.code]);
```

If the design broke, the agent gets the error and writes a revision. One revision is enough here:

```ts
let render = first;
if (first.exitCode !== 0) {
  const error = first.stderr;
  const fix = await step.run("revise-design", () =>
    designCard({ prompt, variant, previousError: error }),
  );
  render = await sandbox.commands.run("render-revision", ["node", "-e", fix.code]);
}
```

The score: whether the first design rendered is recorded against the variant, and the recipient's
reaction is scored later by the same deferred scorer as Day 12:

```ts
await inngest.score.experiment({
  name: "renders-first-try",
  value: first.exitCode === 0,
  experiment: experimentRef,
});
defer("score-reaction", { function: reactionScorer, data: { cardId }, experiment: experimentRef });
await sandbox.destroy("destroy-renderer");
```

`step.score()` has no `experiment` option, so `inngest.score.experiment()` is how a score gets
credited to a variant. It runs at the function body, outside any step. The function returns
`{ variant, svg }`, so the finished card is in the run's output.

Sandboxes and scoring are both beta, and they need `sandboxMiddleware()` and `scoreMiddleware()`
from `inngest/experimental` on the client (see `client.ts`). The fake designer breaks about one
card in three, and "bold" breaks more often than "classic".

## Watch it

Sandboxes are an open beta on Inngest Cloud (Pro and up), so this day can't run on a plain local
Dev Server, and `pnpm check` skips it. Log in once, and the local Dev Server runs your functions
and runs locally while the sandboxes run in Cloud:

```sh
npx inngest-cli@latest login
REACTION_TTL=60s pnpm day 12b
pnpm send 12b design-1
```

Card `c1` is one whose first design always breaks. In the run trace at http://localhost:8288 you
should see `design-classic` or `design-bold`, then `create-renderer`, `render-card` (it fails with
a `ReferenceError`), `revise-design`, `render-revision` (it works), `destroy-renderer` and
`deliver`. The run's output holds the rendered SVG.

For the comparison, send twelve cards and let every recipient react:

```sh
pnpm send 12b design-12
```

To record against Inngest Cloud itself, with keys from your environment (see Day 12):

```sh
export INNGEST_SIGNING_KEY=signkey-… INNGEST_EVENT_KEY=…
REACTION_TTL=60s pnpm day 12b --cloud
pnpm send 12b design-1 --cloud
```

The ledger wall at http://localhost:3112 has **Request card c1**, **c1: Loved it** and
**c1: Meh** buttons.

## In your app

Any time an agent produces something you must execute (code, a script, a query), run it in a
sandbox and treat the exit code as an ordinary result. Destroy the sandbox when you're done; if a
run ends early, the SDK's cleanup function destroys it for you. Then score two things: did it
work, and was it good, and keep the score names stable.

## Next

That's Day 12, cut B. Back to [Day 12](../12-measure-what-works) for the experiment on its own.
