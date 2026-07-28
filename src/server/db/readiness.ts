const DEFAULT_RETRY_DELAYS_MS = [250, 500, 1_000, 2_000] as const;

export class DatabaseUnavailableError extends Error {
  override readonly cause: unknown;

  constructor(cause: unknown) {
    super("Database is still waking up");
    this.name = "DatabaseUnavailableError";
    this.cause = cause;
  }
}

function errorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("code" in error)) return undefined;
  const { code } = error as { code?: unknown };
  return typeof code === "string" ? code : undefined;
}

/** Errors that occur before PostgreSQL can accept a query during a cold start. */
export function isDatabaseWakeError(error: unknown): boolean {
  const code = errorCode(error);
  if (
    code &&
    [
      "ECONNREFUSED",
      "ECONNRESET",
      "EHOSTUNREACH",
      "ENETUNREACH",
      "ENOTFOUND",
      "EPIPE",
      "ETIMEDOUT",
      "08000",
      "08001",
      "08003",
      "08004",
      "08006",
      "08007",
      "08P01",
      "57P01",
      "57P02",
      "57P03",
    ].includes(code)
  ) {
    return true;
  }

  if (error instanceof AggregateError) {
    return error.errors.length > 0 && error.errors.every(isDatabaseWakeError);
  }

  return false;
}

interface ReadinessOptions {
  check: () => Promise<unknown>;
  freshnessMs?: number;
  retryDelaysMs?: readonly number[];
  now?: () => number;
  sleep?: (delayMs: number) => Promise<void>;
  onWaiting?: () => void;
  onReadyAfterRetry?: () => void;
}

/**
 * Build a coalesced readiness gate. Concurrent cold-start requests share one
 * probe, and recently successful probes do not add a query to every request.
 */
export function createDatabaseReadiness({
  check,
  freshnessMs = 30_000,
  retryDelaysMs = DEFAULT_RETRY_DELAYS_MS,
  now = Date.now,
  sleep = (delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs)),
  onWaiting,
  onReadyAfterRetry,
}: ReadinessOptions): () => Promise<void> {
  let lastReadyAt = Number.NEGATIVE_INFINITY;
  let pending: Promise<void> | undefined;

  const probe = async (): Promise<void> => {
    for (let attempt = 0; ; attempt++) {
      try {
        await check();
        lastReadyAt = now();
        if (attempt > 0) onReadyAfterRetry?.();
        return;
      } catch (error) {
        if (!isDatabaseWakeError(error)) throw error;
        if (attempt >= retryDelaysMs.length) throw new DatabaseUnavailableError(error);
        if (attempt === 0) onWaiting?.();
        await sleep(retryDelaysMs[attempt]);
      }
    }
  };

  return async () => {
    if (now() - lastReadyAt < freshnessMs) return;
    if (!pending) {
      pending = probe().finally(() => {
        pending = undefined;
      });
    }
    await pending;
  };
}
