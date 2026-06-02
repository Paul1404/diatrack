import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { auth } from "~/server/auth";
import { getEnv } from "~/server/env";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  isAdmin: boolean;
}

/**
 * Server function used in route beforeLoad guards. Reads the request headers,
 * resolves the better-auth session, and returns a trimmed user or null.
 */
export const fetchSession = createServerFn({ method: "GET" }).handler(
  async (): Promise<SessionUser | null> => {
    const result = await auth.api.getSession({ headers: getRequest().headers });
    if (!result?.user) return null;
    const user = result.user as typeof result.user & { isAdmin?: boolean };
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      isAdmin: user.isAdmin ?? false,
    };
  },
);

export const registrationEnabled = createServerFn({ method: "GET" }).handler(
  async (): Promise<boolean> => getEnv().ALLOW_REGISTRATION,
);
