# UI kit

Plain CSS for every day's browser page. No build step, no dependencies, system fonts only.

- `tokens.css`: colors, type, spacing, widths (custom properties)
- `components.css`: every component below
- `specimen.html`: everything on one page, ending in the full dashboard layout. Open it over http.

## How a day uses it

Days may not import from each other, and `@12days/shared` stays as it is. So the kit is two
CSS files that a day's own Express server serves:

```ts
app.use("/ui", express.static(join(import.meta.dirname, "../../../ui")));
```

Then `<link rel="stylesheet" href="/ui/tokens.css">` and `/ui/components.css`.

## Palette

| Token | Hex | Use |
| --- | --- | --- |
| `--paper` / `--surface` | #faf5ea / #fffdf7 | page / cards |
| `--ink` / `--ink-soft` / `--line` | #23302a / #55625a / #e2d9c5 | text, quiet text, hairlines |
| `--evergreen` | #1f4a3a | headings, primary, done |
| `--night`, `--night-raised`, `--night-line`, `--night-ink`, `--night-soft` | #0b2a1f, #123a2b, #2c5c48, #eaf4ee, #8db8a3 | the dark trace panel and masthead |
| `--lime` / `--coral` | #1fdf64 / #ff8a73 | bright accents (bulbs, running, waiting, main button) |
| `--coral-deep` | #b83f29 | coral as text on paper |
| `--yellow` | #f2c230 | one small detail per screen |
| `--cranberry` / `--brass` | #8e2a3a / #8a6a1f | failure only / a second try |

## Components

- Layout: `.page`, `.stack`, `.row`, `.dashboard-page` + `.dashboard` (send, live, trace)
- `.masthead` (dark band) with `.brand` and `.string-lights` (`.bulb > b`, decoration)
- `.stamp` (`.coral`, `.lime` on dark): outlined tag, use sparingly
- `.trace` (`.tilt`): `.trace-head`, `.trace-rows > .trace-row[data-status]`, `.trace-foot`.
  Statuses: done, running, queued, waiting, retrying, failed
- `.status-feed > li[data-status]`: friendly lines; done, running, pending, retrying, failed
- `.send-card` + `.field` (+ `.hint`): the order form; `.button.coral` for Send
- `.switch > .switch-option[aria-pressed]`: The problem / The fix
- `.compare > .compare-side[data-side="problem|fix"]` with `dl > div > dd + dt` counters, or `.compare-empty`
- `.compare.strip`: the same markup as one slim row pinned to the bottom of the screen (always visible). `.dashboard-page` pads itself to clear it. `data-active="true"` on a side warms it
- `.scene` (inline SVG hearth, copy it from the specimen) and `.empty`
- From before: `.card`, `.button`, `.steps`/`.step`, `.feed`, `.holiday-card`, `.lede`, `.muted`, `.rule`

## Rules

- Light paper is the page. Night green is a surface (masthead, trace), not a theme.
- Mono, caps and small boxes live in the trace and stamps only. Elsewhere: serif headings, sans body.
- Nothing under 16px. At 1600px and wider the root grows to 125% for recording.
- Flat: hairlines, color blocks, no gradients, shadows or icons. Cranberry only for trouble.
- Motion: only the bulbs twinkle, and not with `prefers-reduced-motion`.
- Add a token before adding a one-off color or size.
