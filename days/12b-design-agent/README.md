> **Parked:** not part of the 12 episodes for now. The code stays here, but nothing links to it.

# Day 12b: Can the agent design the card, safely?

**Key idea:** run agent-written code in an Inngest Sandbox, treat a crash as data, and score each
design style.

## Problem

An AI agent designs each card as code, and that code has to run somewhere. On your own servers
it can crash or hang the worker. And nothing tells you which design style works better.

## Break it

There is no `-before` scenario. The naive version runs the generated program inside your app, and
records nothing about which style broke.

## Fix it

An experiment splits cards between two design styles. Each asks the agent (a fake here) for a
small Node program that prints the card as SVG:

```ts
const { result, variant, experimentRef } = await group.experiment("design-prompt", {
  variants: {
    classic: () => step.run("design-classic", () => designCard({ prompt, variant: "classic" })),
    bold: () => step.run("design-bold", () => designCard({ prompt, variant: "bold" })),
  },
  select: experiment.weighted({ classic: 50, bold: 50 }),
});
```

The program runs in a sandbox, a throwaway VM in Inngest Cloud. A crash comes back as data
(`exitCode`, `stderr`), not an exception:

```ts
const sandbox = await step.sandbox.create("create-renderer", {
  name: `card-${cardId}`,
  vcpu: 1,
  memoryMb: 1024,
});

const first = await sandbox.commands.run("render-card", ["node", "-e", result.code]);
```

If the design broke, the agent gets the error and revises it once:

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

Whether the first design rendered is scored against the variant. The recipient's reaction is scored
later by Day 12's deferred scorer:

```ts
await inngest.score.experiment({
  name: "renders-first-try",
  value: first.exitCode === 0,
  experiment: experimentRef,
});

defer("score-reaction", {
  function: reactionScorer,
  data: { cardId },
  experiment: experimentRef,
});

await sandbox.destroy("destroy-renderer");
```

`step.score()` has no `experiment` option, so `inngest.score.experiment()` credits a variant. It
runs in the function body, outside any step.

`sandboxMiddleware()` and `scoreMiddleware()` from `inngest/experimental` must be on the client
(see `client.ts`). Both are beta. The fake designer breaks about one card in three, and "bold"
more often than "classic".

## Watch it

Sandboxes are an open beta on Inngest Cloud (Pro and up), so this day can't run on a plain local
Dev Server, and `pnpm check` skips it. Log in once. The local Dev Server then runs your functions
while the sandboxes run in Cloud:

```sh
npx inngest-cli@latest login
pnpm day 12b
pnpm send 12b design-1
```

Card `c1` always breaks its first design. In the Dev Server (http://localhost:8288) the run shows
`design-classic` or `design-bold`, `create-renderer`, `render-card` (fails with a
`ReferenceError`), `revise-design`, `render-revision` (works), `destroy-renderer` and `deliver`.
The run output holds the SVG.

For the comparison, send four cards and let every recipient react:

```sh
pnpm send 12b design-4
```

To record in Inngest Cloud itself, set the keys as in [Day 12](../12-measure-what-works) and add
`--cloud` to both commands.

The ledger wall (http://localhost:3112) has **Request card c1**, **c1: Loved it** and **c1: Meh**
buttons.

## In your app

Run anything an agent produces (code, a script, a query) in a sandbox, and treat the exit code as
an ordinary result. Destroy the sandbox when done. Then score two things: did it work, and was it
good.
