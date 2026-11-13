# Day 08: Why am I paying for every keystroke?

**Key idea:** `debounce` waits for the events to stop, then runs once with the latest one.

## Problem

The live preview regenerates the card on every edit. Typing one message triggers eight LLM calls,
and only the last is ever shown.

## Break it

```sh
pnpm day 08
pnpm send 08 typing-burst-before
```

Eight edits arrive 300 ms apart. The `[llm] writeCard c1 billed …` lines show eight bills.

## Fix it

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

Each edit restarts a three-second timer. When the user goes quiet, the function runs once.

```sh
pnpm send 08 typing-burst
pnpm send 08 two-cards
```

`typing-burst` bills once. `two-cards` edits two cards at once, and the `key` gives each its own
timer: two bills, one per card.

## Watch it

- Dev Server (http://localhost:8288): all eight `card/edited` events appear, but
  `regenerate-preview` has one run, triggered by the last edit.
- Ledger wall (http://localhost:3008): type into **Card message (no debounce)** and the bill climbs
  with every keystroke. **Reset**, type into **Card message**, and it bills once.

## In your app

Debounce input that comes in bursts: autosave, search-as-you-type, re-indexing. Key it by the
thing being edited. Add `timeout` if a run must happen even when edits never stop.

## Next

Tomorrow one card goes to fifty people, and one failed delivery must not resend the other 49.
