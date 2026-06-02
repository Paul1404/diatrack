import { ORPCError } from "@orpc/server";
import { eq } from "drizzle-orm";
import * as v from "valibot";
import { db } from "~/server/db";
import { DEFAULT_USER_SETTINGS, type UserSettings, user } from "~/server/db/schema";
import { authed } from "~/server/orpc/context";

async function loadSettings(userId: string): Promise<UserSettings> {
  const [row] = await db
    .select({ settings: user.settings })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  if (!row) throw new ORPCError("NOT_FOUND", { message: "Benutzer nicht gefunden" });
  return { ...DEFAULT_USER_SETTINGS, ...row.settings };
}

export const get = authed.handler(async ({ context }): Promise<UserSettings> => {
  return loadSettings(context.user.id);
});

export const update = authed
  .input(
    v.object({
      sensorDefaultHours: v.optional(v.pipe(v.number(), v.minValue(1))),
      catheterDefaultHours: v.optional(v.pipe(v.number(), v.minValue(1))),
      reminderIntervalsHours: v.optional(
        v.array(v.pipe(v.number(), v.minValue(0), v.maxValue(168))),
      ),
    }),
  )
  .handler(async ({ input, context }): Promise<UserSettings> => {
    const current = await loadSettings(context.user.id);
    const next: UserSettings = {
      sensorDefaultHours: input.sensorDefaultHours ?? current.sensorDefaultHours,
      catheterDefaultHours: input.catheterDefaultHours ?? current.catheterDefaultHours,
      reminderIntervalsHours: input.reminderIntervalsHours ?? current.reminderIntervalsHours,
    };
    await db.update(user).set({ settings: next }).where(eq(user.id, context.user.id));
    return next;
  });
