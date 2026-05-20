import { ComponentType, lazy, LazyExoticComponent } from 'react';

const RELOAD_FLAG = 'diatrack.chunk-reloaded';

interface RetryOptions {
  retries?: number;
  delayMs?: number;
}

/**
 * Wrap React.lazy with retry + auto-reload on persistent failure.
 *
 * Why: after a deploy, users with a cached index.html may try to load
 * chunk filenames that no longer exist. Transient network blips on mobile
 * also cause chunk loads to fail. We retry a few times, then trigger a
 * single hard reload to get a fresh index.html. A session flag prevents
 * reload loops if the failure is actually persistent.
 */
export function lazyWithRetry<T extends ComponentType<unknown>>(
  factory: () => Promise<{ default: T }>,
  options: RetryOptions = {},
): LazyExoticComponent<T> {
  const { retries = 2, delayMs = 400 } = options;

  return lazy(async () => {
    let lastError: unknown;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const mod = await factory();
        try {
          sessionStorage.removeItem(RELOAD_FLAG);
        } catch {
          /* ignore */
        }
        return mod;
      } catch (err) {
        lastError = err;
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, delayMs * Math.pow(2, attempt)));
        }
      }
    }

    // All retries exhausted. Reload once to fetch a fresh index.html
    // (and therefore current chunk filenames), unless we've already done so.
    try {
      const alreadyReloaded = sessionStorage.getItem(RELOAD_FLAG);
      if (!alreadyReloaded) {
        sessionStorage.setItem(RELOAD_FLAG, '1');
        window.location.reload();
        // Return a never-resolving promise so Suspense keeps showing the
        // fallback while the reload happens.
        return new Promise<{ default: T }>(() => {});
      }
    } catch {
      /* ignore */
    }

    throw lastError;
  });
}
