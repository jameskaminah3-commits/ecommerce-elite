import type { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";

export type SessionUser = typeof usersTable.$inferSelect;

// Read the verified user id from the SIGNED session cookie. Returns null if the
// cookie is missing or was tampered with (signature mismatch), so a forged
// `userId` value can no longer impersonate anyone.
export function getUserId(req: Request): number | null {
  const raw = (req as Request & { signedCookies?: Record<string, string> }).signedCookies?.userId;
  if (!raw) return null;
  const id = parseInt(String(raw), 10);
  return Number.isNaN(id) ? null : id;
}

async function loadUser(req: Request): Promise<SessionUser | null> {
  const id = getUserId(req);
  if (id == null) return null;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  return user ?? null;
}

// Any authenticated user.
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const user = await loadUser(req);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  (req as Request & { user?: SessionUser }).user = user;
  next();
}

// Authenticated AND role === admin.
export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const user = await loadUser(req);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  if (user.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  (req as Request & { user?: SessionUser }).user = user;
  next();
}
