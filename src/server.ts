import { createStartHandler, defaultStreamHandler } from "@tanstack/react-start/server";
import { DatabaseUnavailableError, ensureDatabaseReady } from "~/server/db";
import { startScheduler } from "~/server/scheduler";

// Boot the in-process reminder scheduler once when the server entry loads.
startScheduler();

const fetch = createStartHandler(defaultStreamHandler);

export default {
  async fetch(...args: Parameters<typeof fetch>) {
    try {
      // The app and PostgreSQL can wake independently on Railway. Hold the
      // first dynamic request until the database accepts connections so auth,
      // SSR, and RPC handlers never see a routine cold-start failure.
      await ensureDatabaseReady();
      return fetch(...args);
    } catch (error) {
      if (error instanceof DatabaseUnavailableError) {
        return Response.json(
          { status: "unavailable", reason: "database_waking" },
          {
            status: 503,
            headers: { "cache-control": "no-store", "retry-after": "2" },
          },
        );
      }
      throw error;
    }
  },
};
