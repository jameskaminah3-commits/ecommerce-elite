import { Router, type IRouter } from "express";
import { db, newsletterSignupsTable } from "@workspace/db";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Public: capture a newsletter signup. Idempotent on email.
router.post("/newsletter", async (req, res): Promise<void> => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  if (!EMAIL_RE.test(email) || email.length > 254) {
    res.status(400).json({ error: "Please enter a valid email address." });
    return;
  }
  try {
    await db
      .insert(newsletterSignupsTable)
      .values({ email })
      .onConflictDoNothing({ target: newsletterSignupsTable.email });
    res.status(201).json({ ok: true });
  } catch (err) {
    logger.error({ err }, "Failed to store newsletter signup");
    res.status(500).json({ error: "Could not sign you up right now. Please try again." });
  }
});

export default router;
