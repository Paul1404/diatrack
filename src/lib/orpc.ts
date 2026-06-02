import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { RouterClient } from "@orpc/server";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import type { AppRouter } from "~/server/orpc/router";

function baseUrl(): string {
  if (typeof window !== "undefined") return window.location.origin;
  return process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
}

const link = new RPCLink({
  url: () => `${baseUrl()}/api/rpc`,
  // Same-origin cookies carry the better-auth session.
  fetch: (request, init) => fetch(request, { ...init, credentials: "include" }),
});

export const client: RouterClient<AppRouter> = createORPCClient(link);

// Type-safe TanStack Query helpers, e.g. orpc.devices.list.queryOptions().
export const orpc = createTanstackQueryUtils(client);
