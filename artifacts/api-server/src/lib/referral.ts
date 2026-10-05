import crypto from "crypto";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";

type UserRow = typeof usersTable.$inferSelect;

// A readable, URL-safe referral code: a stem from the person's name plus a short
// random suffix, e.g. "AMINA-7F3A2C".
function makeCode(name: string): string {
  const stem =
    (name || "FRIEND")
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "")
      .slice(0, 8) || "FRIEND";
  const suffix = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `${stem}-${suffix}`;
}

// Return the user's referral code, generating and persisting one the first time.
// Retries on the (astronomically unlikely) unique collision.
export async function ensureReferralCodeFor(user: Pick<UserRow, "id" | "name" | "referralCode">): Promise<string> {
  if (user.referralCode) return user.referralCode;
  for (let i = 0; i < 6; i++) {
    const code = makeCode(user.name);
    try {
      const [updated] = await db
        .update(usersTable)
        .set({ referralCode: code })
        .where(eq(usersTable.id, user.id))
        .returning();
      if (updated?.referralCode) return updated.referralCode;
    } catch {
      // unique collision — loop and try a fresh suffix
    }
  }
  // Give up gracefully; the caller treats an empty code as "no referral yet".
  return "";
}

// Resolve a referral code to its owner (case-insensitive). Null if unknown.
export async function findReferrerByCode(code: string): Promise<UserRow | null> {
  const c = String(code || "").trim().toUpperCase();
  if (!c) return null;
  const [u] = await db.select().from(usersTable).where(eq(usersTable.referralCode, c));
  return u ?? null;
}
