import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { RegisterUserBody, LoginUserBody } from "@workspace/api-zod";
import crypto from "crypto";

const router: IRouter = Router();

// Simple hash — replace with bcrypt when production credentials are ready
function hashPassword(pwd: string): string {
  return crypto.createHash("sha256").update(pwd + "happyfine_salt").digest("hex");
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
  (req as any).session = { userId: user.id };
  res.status(201).json({ user: userToPublic(user) });
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, parsed.data.email));
  if (!user || user.passwordHash !== hashPassword(parsed.data.password)) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }
  // Store userId in a simple cookie-based session
  res.cookie("userId", String(user.id), { httpOnly: true, sameSite: "lax", maxAge: 7 * 24 * 60 * 60 * 1000 });
  res.json({ user: userToPublic(user) });
});

router.post("/auth/logout", async (_req, res): Promise<void> => {
  res.clearCookie("userId");
  res.sendStatus(204);
});

router.get("/auth/me", async (req, res): Promise<void> => {
  const rawId = req.cookies?.userId;
  if (!rawId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const userId = parseInt(rawId, 10);
  if (isNaN(userId)) {
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
