// Diagnostic + admin password reset.
//
// Run this with the SAME environment the API server uses (same DATABASE_URL),
// so there is zero ambiguity about which database it touches:
//
//   pnpm --filter @workspace/scripts exec tsx ./src/reset-admin.ts
//
// It prints which database it connected to and every user row (with a short
// hash prefix), then upserts admin@happyfine.co.ke with a fresh, correct hash
// for the password "password". After it runs, log in with:
//   admin@happyfine.co.ke / password
import crypto from "crypto";
import { eq } from "drizzle-orm";
import { db, pool, usersTable } from "@workspace/db";

const ADMIN_EMAIL = "admin@happyfine.co.ke";
const NEW_PASSWORD = "password";
const SCRYPT_KEYLEN = 64;

// Must match hashPassword() in artifacts/api-server/src/routes/auth.ts.
function hashPassword(pwd: string): string {
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(pwd, salt, SCRYPT_KEYLEN);
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

function maskedDbTarget(): string {
  const url = process.env.DATABASE_URL ?? "(unset)";
  // Hide the password but show host/port/db so you can confirm the target.
  return url.replace(/:\/\/([^:]+):[^@]+@/, "://$1:****@");
}

async function main() {
  console.log("Connected DATABASE_URL:", maskedDbTarget());

  const users = await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      role: usersTable.role,
      hash: usersTable.passwordHash,
    })
    .from(usersTable);

  console.log(`\nExisting users (${users.length}):`);
  for (const u of users) {
    console.log(
      `  #${u.id}  ${u.email}  role=${u.role}  hash=${u.hash.slice(0, 16)}…`,
    );
  }

  const newHash = hashPassword(NEW_PASSWORD);
  const [existing] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, ADMIN_EMAIL));

  if (existing) {
    await db
      .update(usersTable)
      .set({ passwordHash: newHash, role: "admin" })
      .where(eq(usersTable.email, ADMIN_EMAIL));
    console.log(`\n✅ Updated ${ADMIN_EMAIL} (role=admin) password to "${NEW_PASSWORD}".`);
  } else {
    await db.insert(usersTable).values({
      name: "Happyfine Admin",
      email: ADMIN_EMAIL,
      passwordHash: newHash,
      phone: "0700000000",
      role: "admin",
    });
    console.log(`\n✅ Created ${ADMIN_EMAIL} (role=admin) with password "${NEW_PASSWORD}".`);
  }

  console.log("\nNow log in with:");
  console.log(`   ${ADMIN_EMAIL} / ${NEW_PASSWORD}`);

  await pool.end();
}

main().catch((err) => {
  console.error("reset-admin failed:", err);
  process.exit(1);
});
