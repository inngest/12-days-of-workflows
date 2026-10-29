import { AsyncLocalStorage } from "node:async_hooks";
import { Middleware, RetryAfterError } from "inngest";
import { ProviderError } from "./errors.js";
import type { Provider } from "./ledger.js";

export type ChaosSpec = {
  failTimes: number; // fail this many calls…
  afterCalls?: number; // …after letting this many succeed (default 0)
  status?: 429 | 500;
  retryAfterMs?: number;
  retryInMs?: number; // ask Inngest to retry after this many ms (keeps demos fast)
};

export type Chaos = { llm?: ChaosSpec; image?: ChaosSpec; mail?: ChaosSpec };

type RunStore = { cardId?: string; chaos?: Chaos };

const runStore = new AsyncLocalStorage<RunStore>();

function storeFrom(ctx: Middleware.WrapFunctionHandlerArgs["ctx"]): RunStore {
  const data = (ctx.event?.data ?? {}) as RunStore;
  return { cardId: data.cardId, chaos: data.chaos };
}

/** Puts `event.data.chaos` and `event.data.cardId` where every fake can read them. */
export const chaosMiddleware = class ChaosMiddleware extends Middleware.BaseMiddleware {
  readonly id = "12days-chaos";

  wrapFunctionHandler({ ctx, next }: Middleware.WrapFunctionHandlerArgs) {
    return runStore.run(storeFrom(ctx), () => next());
  }

  wrapStepHandler({ ctx, next }: Middleware.WrapStepHandlerArgs) {
    return runStore.run(storeFrom(ctx), () => next());
  }

  // Child runs (step.invoke, step.sendEvent) inherit this run's cardId and chaos.
  transformStepInput(arg: Middleware.TransformStepInputArgs) {
    // An invoke step's input is [{ function_id, payload: { data } }].
    const [opts, ...rest] = arg.input as [{ payload?: { data?: Record<string, unknown> } }];
    if (arg.stepInfo.stepType !== "invoke" || !opts?.payload) return arg;
    const payload = { ...opts.payload, data: withRunStore(opts.payload.data) };
    return { ...arg, input: [{ ...opts, payload }, ...rest] };
  }

  transformSendEvent(arg: Middleware.TransformSendEventArgs) {
    return { ...arg, events: arg.events.map((e) => ({ ...e, data: withRunStore(e.data) })) };
  }
};

/** Adds the current run's cardId and chaos to child event data, unless already set. */
function withRunStore(data: Record<string, unknown> | undefined): Record<string, unknown> {
  const store = runStore.getStore();
  if (!store) return data ?? {};
  return { cardId: store.cardId, chaos: store.chaos, ...data };
}

/** Internal: the cardId of the run currently executing, if any. */
export function currentCardId(): string | undefined {
  return runStore.getStore()?.cardId;
}

/**
 * Internal: how this call should fail, or null to succeed. With `retryInMs`, the error is a
 * RetryAfterError so the Dev Server retries in about a second instead of minutes of backoff.
 */
export function chaosFailure(
  provider: Provider,
  callNumber: number,
): { status: 429 | 500; error: Error } | null {
  if (provider === "warehouse") return null;
  const spec = runStore.getStore()?.chaos?.[provider];
  if (!spec) return null;
  const after = spec.afterCalls ?? 0;
  if (callNumber <= after || callNumber > after + spec.failTimes) return null;
  const providerError = new ProviderError(spec.status ?? 500, spec.retryAfterMs);
  if (spec.retryInMs === undefined) return { status: providerError.status, error: providerError };
  const error = new RetryAfterError(providerError.message, spec.retryInMs, {
    cause: providerError,
  });
  return { status: providerError.status, error };
}
