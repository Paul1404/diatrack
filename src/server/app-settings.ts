import { eq } from "drizzle-orm";
import { db } from "~/server/db";
import { type AppSettingsRow, appSettings } from "~/server/db/schema";

/** Read the singleton app settings row, creating it with defaults if missing. */
export async function getAppSettings(): Promise<AppSettingsRow> {
  const [existing] = await db.select().from(appSettings).where(eq(appSettings.id, 1)).limit(1);
  if (existing) return existing;
  const [created] = await db.insert(appSettings).values({ id: 1 }).returning();
  return created;
}
