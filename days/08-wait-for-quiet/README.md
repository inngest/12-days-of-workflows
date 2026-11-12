# Day 08: Why does every keystroke cost me an LLM call?

## The problem

The live preview regenerates on every edit, so a user typing a message bills eight LLM calls for
one card. Only the last one is ever read.

## Break it

```sh
pnpm day 08
pnpm send 08 typing-burst-before
```

Eight edits to card `c1` arrive 300 ms apart. Watch the `[llm]` lines: eight `writeCard` calls,
eight bills, and eight runs of `regenerate-preview-before`.

## Fix it

Debounce by card. The function waits until that card has been quiet for 3 seconds, then runs once
with the latest event.

```ts
debounce: { key: "event.data.cardId", period: "3s" },
```

```sh
pnpm send 08 typing-burst
pnpm send 08 two-cards
```

One `writeCard` call, using `c1 draft 8`. In `two-cards`, the bursts interleave but each card has
its own timer, so you get two calls, one per card.

## Watch it

In http://localhost:8288, filter runs by `regenerate-preview`. Nothing starts while edits keep
arriving. About 3 seconds after the last one, a single run appears carrying the final event.

Prefer a friendlier view? `pnpm studio` (http://localhost:3100) follows this day, and its
problem/fix switch matches `typing-burst-before` and `typing-burst`.

## In your app

Debounce fits anything a user triggers repeatedly while still deciding: autosave, search-as-you-type,
live previews. Key it by whatever the work belongs to. Add `timeout` if a never-ending stream of
edits must still produce a result eventually. Debounce can't be combined with batching.

## Next

Tomorrow's problem: our bulk send failed halfway and 24 people got the card twice.
