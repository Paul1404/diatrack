import { ORPCError, os } from "@orpc/server";
import { auth } from "~/server/auth";

export interface ORPCContext {
  headers: Headers;
}

export const base = os.$context<ORPCContext>();

/**
 * Resolves the better-auth session from request headers and rejects when there
 * is no active session. Every protected procedure builds on this so auth is
 * always enforced server-side, never on route guards alone.
 */
export const requireAuth = base.middleware(async ({ context, next }) => {
  const result = await auth.api.getSession({ headers: context.headers });
  if (!result?.session) {
    throw new ORPCError("UNAUTHORIZED", { message: "Nicht angemeldet" });
  }
  return next({
    context: {
      ...context,
      session: result.session,
      user: result.user,
    },
  });
});

/** Authenticated procedure builder. */
export const authed = base.use(requireAuth);

/** Admin-only procedure builder (requires an authenticated admin user). */
export const admin = authed.use(({ context, next }) => {
  if (!context.user.isAdmin) {
    throw new ORPCError("FORBIDDEN", { message: "Keine Berechtigung" });
  }
  return next({ context });
});
