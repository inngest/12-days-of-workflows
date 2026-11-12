# Day 07: Why do my retries make the rate limit worse?

## The problem

The image API allows a handful of calls per period. Fifteen cards at once blow straight through
it, and every 429 is a retry that lands on the same busy provider.

## Break it

```sh
IMAGE_RATE=5/3s pnpm day 07   # the provider allows 5 calls per 3 seconds
pnpm send 07 burst-before
```

Watch the `[image]` lines: five calls get through, ten are rate limited, then the retries come
back and some are rejected again. Everything is eventually delivered, but only after a wall of
wasted calls.

The numbers are tuned for video: the provider allows 5 calls per 3 seconds and the throttle is
3 per 3 seconds, so the demo finishes in about 15 seconds. The throttle sits below the limit
because Inngest lets one extra start through at the front of a window, and 3 keeps every window
under 5. The fake also asks Inngest to retry after one second, where normal backoff would spread
the retries over minutes.

## Fix it

Add `throttle` to the function that makes the image call, set just under the provider's limit.
Because `render-card-image` is the function from Day 03, one run start is exactly one image call.

```ts
throttle: { limit: 3, period: "3s" },
```

```sh
pnpm send 07 burst
```

Cards still arrive all at once, but renders start about three every three seconds, queued by
Inngest. Every image call succeeds on its first try, and no run fails or retries.

## Watch it

In http://localhost:8288, open the `render-card-image` runs. They don't fail and retry; they wait
in the queue and then start, one after another. Compare with `create-card-before`, where the
steps keep failing with 429.

Prefer a friendlier view? `pnpm studio` (http://localhost:3100) follows this day, and its
problem/fix switch matches `burst-before` and `burst`.

## In your app

Set the throttle just under the provider's documented limit, and put it on the function that
makes the call, so one run start equals one API call. Add a `key` to throttle per customer or API
key.

Concurrency and throttling are different dials. Day 06's `concurrency` limits how many runs are
in flight at the same moment, however slowly they finish. `throttle` limits how many runs start
per period, however quickly each one finishes. A provider that counts calls per time window needs
the throttle. A resource that counts simultaneous work needs concurrency. Throttling limits run
starts, not steps, which is why the throttled step lives in its own function.

## Next

Tomorrow's problem: users smash the regenerate button and we pay for every click.
