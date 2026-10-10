import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { RegisterUserBody, LoginUserBody } from "@workspace/api-zod";
import crypto from "crypto";
import { getUserId } from "../middlewares/requireAdmin";
import { sessionCookieOptions } from "../lib/session";
import { ensureReferralCodeFor, findReferrerByCode } from "../lib/referral";
import { sendAccountWelcomeEmail } from "../lib/email";
import { publicOrigin } from "../seo";
import { logger } from "../lib/logger";

// Emails are matched case-insensitively: Jane@Gmail.com and jane@gmail.com are one account.
const byEmail = (email: string) => sql`lower(${usersTable.email}) = ${email.trim().toLowerCase()}`;

const router: IRouter = Router();

// Password hashing uses scrypt (memory-hard, built into Node — no extra deps)
// with a random per-user salt, stored as `scrypt$<saltHex>$<hashHex>`.
const SCRYPT_KEYLEN = 64;

function hashPassword(pwd: string): string {
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(pwd, salt, SCRYPT_KEYLEN);
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

// Legacy hashes are a static-salt SHA-256 hex digest. Kept only so accounts
// created (or seeded) before the scrypt upgrade can still sign in; they are
// transparently re-hashed to scrypt on the next successful login.
function legacyHash(pwd: string): string {
  return crypto.createHash("sha256").update(pwd + "happyfine_salt").digest("hex");
}

function isLegacyHash(stored: string): boolean {
  return !stored.startsWith("scrypt$");
}

// Constant-time comparison of a candidate password against a stored hash of
// either format. Accounts with no password (Google / OTP-only) can't log in
// this way.
function verifyPassword(pwd: string, stored: string | null): boolean {
  if (!stored) return false;
  if (isLegacyHash(stored)) {
    const a = Buffer.from(legacyHash(pwd));
    const b = Buffer.from(stored);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }
  const [, saltHex, hashHex] = stored.split("$");
  if (!saltHex || !hashHex) return false;
  const derived = crypto.scryptSync(pwd, Buffer.from(saltHex, "hex"), SCRYPT_KEYLEN);
  const expected = Buffer.from(hashHex, "hex");
  return derived.length === expected.length && crypto.timingSafeEqual(derived, expected);
}

function userToPublic(u: typeof usersTable.$inferSelect) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    role: u.role,
    referralCode: u.referralCode ?? null,
    createdAt: u.createdAt.toISOString(),
  };
}

router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = RegisterUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const existing = await db.select().from(usersTable).where(byEmail(parsed.data.email));
  if (existing.length > 0) {
    res.status(400).json({ error: "An account with this email already exists. Please sign in instead." });
    return;
  }
  const [user] = await db
    .insert(usersTable)
    .values({
      name: parsed.data.name.trim(),
      email: parsed.data.email.trim().toLowerCase(),
      phone: parsed.data.phone,
      passwordHash: hashPassword(parsed.data.password),
      role: "customer",
    })
    .returning();

  // Attribute the signup to a referrer if they arrived with a referral code
  // (the storefront drops it in a `ref` cookie when someone opens a share link).
  const refCode = typeof req.cookies?.ref === "string" ? req.cookies.ref : "";
  if (refCode) {
    const referrer = await findReferrerByCode(refCode);
    if (referrer && referrer.id !== user.id) {
      await db.update(usersTable).set({ referredByUserId: referrer.id }).where(eq(usersTable.id, user.id));
    }
  }
  // Give the new customer their own code to share.
  const referralCode = await ensureReferralCodeFor(user);

  // Welcome email (fire-and-forget — never blocks signing up).
  const origin = publicOrigin(req);
  void sendAccountWelcomeEmail(user.email, { name: user.name, shopUrl: `${origin}/products`, accountUrl: `${origin}/account` }).catch((err) =>
    logger.error({ err }, "Account welcome email failed"),
  );

  // Log the newly registered user in, mirroring the login flow.
  res.cookie("userId", String(user.id), sessionCookieOptions());
  res.status(201).json({ user: userToPublic({ ...user, referralCode }) });
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [user] = await db.select().from(usersTable).where(byEmail(parsed.data.email));
  if (!user || !verifyPassword(parsed.data.password, user.passwordHash)) {
    res.status(401).json({ error: "That email and password don't match. Please try again." });
    return;
  }
  // Transparently upgrade legacy SHA-256 hashes to scrypt on successful login.
  if (user.passwordHash && isLegacyHash(user.passwordHash)) {
    await db
      .update(usersTable)
      .set({ passwordHash: hashPassword(parsed.data.password) })
      .where(eq(usersTable.id, user.id));
  }
  // Store userId in a signed cookie-based session
  res.cookie("userId", String(user.id), sessionCookieOptions());
  const referralCode = await ensureReferralCodeFor(user);
  res.json({ user: userToPublic({ ...user, referralCode }) });
});

router.post("/auth/logout", async (_req, res): Promise<void> => {
  res.clearCookie("userId");
  res.sendStatus(204);
});

router.get("/auth/me", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  if (userId == null) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const referralCode = await ensureReferralCodeFor(user);
  res.json(userToPublic({ ...user, referralCode }));
});

export default router;
