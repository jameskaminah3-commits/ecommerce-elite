import { Router, type IRouter } from "express";
import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import crypto from "crypto";
import { db, usersTable, emailOtpCodesTable } from "@workspace/db";
import { sendOtpEmail, isEmailConfigured } from "../lib/email";
import { setSessionCookie } from "../lib/session";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const MAX_ACTIVE_PER_EMAIL = 5; // rate-limit requests within the TTL window

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function hashCode(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

function generateCode(): string {
  // 6-digit numeric, zero-padded, cryptographically random.
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
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

// ── Request a code ─────────────────────────────────────────────────────────
router.post("/auth/otp/request", async (req, res): Promise<void> => {
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    res.status(400).json({ error: "A valid email is required." });
    return;
  }

  // Rate-limit: cap the number of unconsumed, unexpired codes per email.
  const [{ count }] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(emailOtpCodesTable)
    .where(
      and(
        eq(emailOtpCodesTable.email, email),
        isNull(emailOtpCodesTable.consumedAt),
        gt(emailOtpCodesTable.expiresAt, new Date()),
      ),
    );
  if (count >= MAX_ACTIVE_PER_EMAIL) {
    res.status(429).json({ error: "Too many codes requested. Please wait a few minutes and try again." });
    return;
  }

  const code = generateCode();
  await db.insert(emailOtpCodesTable).values({
    email,
    codeHash: hashCode(code),
    expiresAt: new Date(Date.now() + CODE_TTL_MS),
  });

  const sent = await sendOtpEmail(email, code);

  // In local dev without an email provider wired up, return the code so the
  // flow is testable. Never leak it once email is configured or in production.
  const devCode =
    !sent && !isEmailConfigured() && process.env["NODE_ENV"] !== "production" ? code : undefined;
  if (devCode) logger.warn({ email, code }, "OTP email not sent (dev) — returning code inline");

  res.json({ sent: true, ...(devCode ? { devCode } : {}) });
});

// ── Verify a code ──────────────────────────────────────────────────────────
router.post("/auth/otp/verify", async (req, res): Promise<void> => {
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const code = String(req.body?.code ?? "").trim();
  if (!EMAIL_RE.test(email) || !/^\d{6}$/.test(code)) {
    res.status(400).json({ error: "Enter the 6-digit code sent to your email." });
    return;
  }

  const [row] = await db
    .select()
    .from(emailOtpCodesTable)
    .where(and(eq(emailOtpCodesTable.email, email), isNull(emailOtpCodesTable.consumedAt)))
    .orderBy(desc(emailOtpCodesTable.createdAt))
    .limit(1);

  if (!row || row.expiresAt.getTime() < Date.now()) {
    res.status(400).json({ error: "That code has expired. Request a new one." });
    return;
  }
  if (row.attempts >= MAX_ATTEMPTS) {
    res.status(429).json({ error: "Too many incorrect attempts. Request a new code." });
    return;
  }

  const candidate = Buffer.from(hashCode(code));
  const expected = Buffer.from(row.codeHash);
  const matches = candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);

  if (!matches) {
    await db
      .update(emailOtpCodesTable)
      .set({ attempts: row.attempts + 1 })
      .where(eq(emailOtpCodesTable.id, row.id));
    res.status(400).json({ error: "Incorrect code. Please try again." });
    return;
  }

  // Single-use: consume the code immediately.
  await db.update(emailOtpCodesTable).set({ consumedAt: new Date() }).where(eq(emailOtpCodesTable.id, row.id));

  // Find or create the user (passwordless signup on first verified login).
  let [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (!user) {
    [user] = await db
      .insert(usersTable)
      .values({
        name: email.split("@")[0],
        email,
        role: "customer",
        emailVerified: true,
      })
      .returning();
  } else if (!user.emailVerified) {
    await db.update(usersTable).set({ emailVerified: true }).where(eq(usersTable.id, user.id));
  }

  setSessionCookie(res, user.id);
  res.json({ user: userToPublic(user) });
});

export default router;
