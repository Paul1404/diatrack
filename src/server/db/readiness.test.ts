import { describe, expect, it, vi } from "vitest";
import {
  createDatabaseReadiness,
  DatabaseUnavailableError,
  isDatabaseWakeError,
} from "./readiness";

const connectionError = (code: string) => Object.assign(new Error(code), { code });

describe("database readiness", () => {
  it("recognizes connection and PostgreSQL startup errors", () => {
    expect(isDatabaseWakeError(connectionError("ECONNREFUSED"))).toBe(true);
    expect(isDatabaseWakeError(connectionError("57P03"))).toBe(true);
    expect(isDatabaseWakeError(connectionError("23505"))).toBe(false);
  });

  it("retries a sleeping database and reports recovery", async () => {
    const check = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(connectionError("ECONNREFUSED"))
      .mockResolvedValue(undefined);
    const onWaiting = vi.fn();
    const onReadyAfterRetry = vi.fn();
    const ensureReady = createDatabaseReadiness({
      check,
      retryDelaysMs: [1],
      sleep: async () => {},
      onWaiting,
      onReadyAfterRetry,
    });

    await ensureReady();

    expect(check).toHaveBeenCalledTimes(2);
    expect(onWaiting).toHaveBeenCalledOnce();
    expect(onReadyAfterRetry).toHaveBeenCalledOnce();
  });

  it("coalesces concurrent probes and caches recent readiness", async () => {
    let release: (() => void) | undefined;
    const check = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    const ensureReady = createDatabaseReadiness({ check });

    const first = ensureReady();
    const second = ensureReady();
    expect(check).toHaveBeenCalledOnce();
    release?.();
    await Promise.all([first, second]);
    await ensureReady();

    expect(check).toHaveBeenCalledOnce();
  });

  it("returns a controlled unavailable error after bounded retries", async () => {
    const check = vi.fn().mockRejectedValue(connectionError("57P03"));
    const ensureReady = createDatabaseReadiness({
      check,
      retryDelaysMs: [1, 1],
      sleep: async () => {},
    });

    await expect(ensureReady()).rejects.toBeInstanceOf(DatabaseUnavailableError);
    expect(check).toHaveBeenCalledTimes(3);
  });

  it("does not hide application or query errors", async () => {
    const error = connectionError("23505");
    const ensureReady = createDatabaseReadiness({ check: async () => Promise.reject(error) });

    await expect(ensureReady()).rejects.toBe(error);
  });
});
