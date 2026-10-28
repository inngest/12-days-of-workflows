export class ProviderError extends Error {
  constructor(
    public status: 429 | 500,
    public retryAfterMs?: number,
  ) {
    super(
      retryAfterMs === undefined
        ? `Provider responded ${status}`
        : `Provider responded ${status}, retry after ${retryAfterMs} ms`,
    );
    this.name = "ProviderError";
  }
}
