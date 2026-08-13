import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import { db, usersTable } from "@workspace/db";
import { isGoogleConfigured, buildAuthUrl, exchangeCodeForProfile } from "../lib/google";
import { setSessionCookie, storefrontUrl } from "../lib/session";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const STATE_COOKIE = "g_oauth_state";

function stateCookieOptions() {
  const isProd = process.env["NODE_ENV"] === "production";
  return {
    httpOnly: true,
    // Lax so the cookie survives the top-level GET redirect back from Google.
    sameSite: "lax" as const,
    secure: isProd,
    maxAge: 10 * 60 * 1000,
    path: "/",
    signed: true,
  };
}

function accountUrl(query = ""): string {
  const base = storefrontUrl();
  const root = base === "/" ? "" : base;
  return `${root}/account${query}`;
}

// Kick off the OAuth flow: set a signed anti-CSRF state cookie, then redirect
// the browser to Google's consent screen.
router.get("/auth/google", (req, res): void => {
  if (!isGoogleConfigured()) {
    res.status(503).json({ error: "Google sign-in is not configured on this server." });
    return;
  }
  const state = crypto.randomBytes(16).toString("hex");
  res.cookie(STATE_COOKIE, state, stateCookieOptions());
  res.redirect(buildAuthUrl(state));
});

// OAuth callback: validate state, exchange the code, then find-or-create the
// user and issue a session before redirecting back to the storefront.
router.get("/auth/google/callback", async (req, res): Promise<void> => {
  if (!isGoogleConfigured()) {
    res.status(503).json({ error: "Google sign-in is not configured on this server." });
    return;
  }

  const { code, state, error } = req.query as Record<string, string | undefined>;
  const expectedState = (req as any).signedCookies?.[STATE_COOKIE];
  res.clearCookie(STATE_COOKIE);

  if (error) {
    res.redirect(accountUrl("?error=google_denied"));
    return;
  }
  if (!code || !state || !expectedState || state !== expectedState) {
    res.redirect(accountUrl("?error=google_state"));
    return;
  }

  try {
    const profile = await exchangeCodeForProfile(code);
    const email = profile.email.toLowerCase();

    // Match by Google id first, then by existing email (linking the account).
    let [user] = await db.select().from(usersTable).where(eq(usersTable.googleId, profile.sub));
    if (!user) {
      [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
      if (user) {
        // Link this Google identity to the existing email account.
        await db
          .update(usersTable)
          .set({ googleId: profile.sub, emailVerified: user.emailVerified || profile.emailVerified })
          .where(eq(usersTable.id, user.id));
      }
    }
    if (!user) {
      [user] = await db
        .insert(usersTable)
        .values({
          name: profile.name,
          email,
          googleId: profile.sub,
          role: "customer",
          emailVerified: profile.emailVerified,
        })
        .returning();
    }

    setSessionCookie(res, user.id);
    res.redirect(accountUrl("?login=google"));
  } catch (err) {
    logger.error({ err }, "Google OAuth callback failed");
    res.redirect(accountUrl("?error=google_failed"));
  }
});

export default router;
