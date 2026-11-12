# Day 08: Why am I paying for every keystroke?

## The problem

The live preview regenerates the card on every edit. Someone typing a one-line message triggers
eight LLM calls, and only the last one is ever shown.

## Break it

```sh
pnpm day 08
pnpm send 08 typing-burst-before
```

Eight edits arrive 300 ms apart. Watch the `[llm] writeCard c1 billed …` lines: eight bills, one
per edit, including the half-typed ones.

## Fix it

Debounce the function per card. Each new edit restarts a three-second timer, and when the user
goes quiet the function runs once with the latest edit.

```ts
export const regeneratePreview = inngest.createFunction(
  {
    id: "regenerate-preview",
    triggers: [cardEdited],
    debounce: { key: "event.data.cardId", period: "3s" },
  },
  async ({ event, step }) =>
    step.run("write-preview", () => writeCard({ prompt: event.data.prompt })),
);
```

```sh
pnpm send 08 typing-burst
pnpm send 08 two-cards
```

`typing-burst` bills once, for the finished message. `two-cards` edits two cards at the same time,
and the `key` gives each card its own timer: two bills, one per card.

## Watch it

In http://localhost:8288 the eight `card/edited` events all show up in the event stream, but
`regenerate-preview` has a single run, and its event is the last edit.

The ledger wall at http://localhost:3008 has two text boxes. Type into **Card message (no
debounce)** and the LLM bill climbs with every keystroke. Hit **Reset**, type into **Card
message**, and it bills once.

## In your app

Debounce anything driven by bursts of user input: autosave, search-as-you-type, re-indexing after
edits, webhooks that fire once per field change. Key it by the thing being edited. Add `timeout`
if a run must happen eventually even when the edits never stop.

## Next

Tomorrow one card goes out to fifty people, and one failed delivery must not resend the other 49.
