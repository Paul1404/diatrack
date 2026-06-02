import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { db, schema } from "~/server/db";
import { getEnv } from "~/server/env";

const env = getEnv();

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  emailAndPassword: {
    enabled: true,
    // Registration is off by default, matching the old ALLOW_REGISTRATION flag.
    disableSignUp: !env.ALLOW_REGISTRATION,
  },
  user: {
    additionalFields: {
      // is_admin replaces fastapi-users is_superuser. input:false so it can never
      // be set through signup; promote via `bun run db:seed`.
      isAdmin: {
        type: "boolean",
        defaultValue: false,
        input: false,
      },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // refresh once a day
  },
  // tanstackStartCookies MUST be the last plugin (cookie handling for TanStack Start).
  plugins: [tanstackStartCookies()],
});

export type Auth = typeof auth;
