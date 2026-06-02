// Promotes a user to admin. Run once after the first account is created:
//   ADMIN_EMAIL=you@example.com bun run db:seed
import { eq } from "drizzle-orm";
import { db } from "./index";
import { user } from "./schema";

async function main() {
  const email = process.env.ADMIN_EMAIL;
  if (!email) {
    console.error("Set ADMIN_EMAIL to the account you want to promote to admin.");
    process.exit(1);
  }

  const result = await db
    .update(user)
    .set({ isAdmin: true })
    .where(eq(user.email, email))
    .returning({ id: user.id, email: user.email });

  if (result.length === 0) {
    console.error(`No user found with email ${email}. Create the account first.`);
    process.exit(1);
  }

  console.info(`Promoted ${result[0].email} to admin.`);
  process.exit(0);
}

main();
