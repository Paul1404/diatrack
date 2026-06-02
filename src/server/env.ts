import * as v from "valibot";

const EnvSchema = v.object({
  DATABASE_URL: v.pipe(v.string(), v.minLength(1, "DATABASE_URL is required")),
  BETTER_AUTH_SECRET: v.pipe(
    v.string(),
    v.minLength(16, "BETTER_AUTH_SECRET must be set to a strong random string"),
  ),
  BETTER_AUTH_URL: v.optional(v.string(), "http://localhost:3000"),
  ALLOW_REGISTRATION: v.optional(
    v.pipe(
      v.string(),
      v.transform((s) => s === "true" || s === "1"),
    ),
    "false",
  ),
  ADMIN_EMAIL: v.optional(v.string(), ""),
  NODE_ENV: v.optional(v.string(), "development"),
});

export type Env = v.InferOutput<typeof EnvSchema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;
  cached = v.parse(EnvSchema, process.env);
  return cached;
}
