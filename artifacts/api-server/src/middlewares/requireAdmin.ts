import type { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";

/**
 * Minimal admin guard built on the existing cookie session. Looks up the user
 * referenced by the `userId` cookie and requires the `admin` role. Attaches the
 * resolved user to `req.user` for downstream handlers.
 */
export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const rawId = req.cookies?.userId;
  const userId = rawId ? parseInt(rawId, 10) : NaN;
  if (!userId || Number.isNaN(userId)) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  if (user.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  (req as Request & { user?: typeof user }).user = user;
  next();
}
