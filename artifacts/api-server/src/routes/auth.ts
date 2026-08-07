import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { RegisterUserBody, LoginUserBody } from "@workspace/api-zod";
import crypto from "crypto";
import { getUserId } from "../middlewares/requireAdmin";

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
// either format.
function verifyPassword(pwd: string, stored: string): boolean {
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

const SESSION_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

// In production the storefront and API are typically served from different
// origins, which requires SameSite=None + Secure for the cookie to be sent on
// cross-site requests. In development we keep Lax so it works over plain HTTP.
function sessionCookieOptions() {
  const isProd = process.env["NODE_ENV"] === "production";
  return {
    httpOnly: true,
    sameSite: isProd ? ("none" as const) : ("lax" as const),
    secure: isProd,
    maxAge: SESSION_MAX_AGE,
    path: "/",
    signed: true,
  };
}

function userToPublic(u: typeof usersTable.$inferSelect) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    role: u.role,
    createdAt: u.createdAt.toISOString(),
  };
}

router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = RegisterUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const existing = await db.select().from(usersTable).where(eq(usersTable.email, parsed.data.email));
  if (existing.length > 0) {
    res.status(400).json({ error: "Email already registered" });
    return;
  }
  const [user] = await db
    .insert(usersTable)
    .values({
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone,
      passwordHash: hashPassword(parsed.data.password),
      role: "customer",
    })
    .returning();
  // Log the newly registered user in, mirroring the login flow.
  res.cookie("userId", String(user.id), sessionCookieOptions());
  res.status(201).json({ user: userToPublic(user) });
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, parsed.data.email));
  if (!user || !verifyPassword(parsed.data.password, user.passwordHash)) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }
  // Transparently upgrade legacy SHA-256 hashes to scrypt on successful login.
  if (isLegacyHash(user.passwordHash)) {
    await db
      .update(usersTable)
      .set({ passwordHash: hashPassword(parsed.data.password) })
      .where(eq(usersTable.id, user.id));
  }
  // Store userId in a signed cookie-based session
  res.cookie("userId", String(user.id), sessionCookieOptions());
  res.json({ user: userToPublic(user) });
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
  res.json(userToPublic(user));
});

export default router;
