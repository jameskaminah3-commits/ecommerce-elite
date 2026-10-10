import { randomBytes } from "node:crypto";
import { and, eq, isNull, or, sql, ne } from "drizzle-orm";
import { db, newsletterSignupsTable, ordersTable } from "@workspace/db";

// Newsletter welcome codes: one personal, single-use code per subscriber, worth a
// percentage off their FIRST order. "First order" is enforced at checkout: the
// code is refused if this email, phone or account already has an order.

// No look-alike characters (0/O, 1/I/L) — people type these from an email or SMS.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function newWelcomeCode(): string {
  const bytes = randomBytes(6);
  let s = "";
  for (const b of bytes) s += ALPHABET[b % ALPHABET.length];
  return `WELCOME-${s}`;
}

export function newToken(): string {
  return randomBytes(18).toString("base64url");
}

export function normalizeCode(input: unknown): string {
  return String(input ?? "").trim().toUpperCase().replace(/\s+/g, "");
}

export type CodeCheck =
  | { ok: true; percent: number; code: string }
  | { ok: false; error: string };

// Is this code usable right now (ignoring who is using it)?
export async function lookupCode(input: unknown): Promise<CodeCheck & { row?: typeof newsletterSignupsTable.$inferSelect }> {
  const code = normalizeCode(input);
  if (!code) return { ok: false, error: "Enter a discount code." };
  const [row] = await db.select().from(newsletterSignupsTable).where(eq(newsletterSignupsTable.code, code));
  if (!row || row.discountPercent <= 0) return { ok: false, error: "That code isn't valid. Please check it and try again." };
  if (row.usedAt) return { ok: false, error: "This code has already been used." };
  if (row.expiresAt && row.expiresAt.getTime() < Date.now()) return { ok: false, error: "This code has expired." };
  return { ok: true, percent: row.discountPercent, code, row };
}

// Welcome codes are for a customer's first order only.
export async function hasPreviousOrder(who: { userId?: number | null; email?: string | null; phone?: string | null }): Promise<boolean> {
  const conds = [] as ReturnType<typeof eq>[];
  if (who.userId != null) conds.push(eq(ordersTable.userId, who.userId));
  const email = who.email?.trim().toLowerCase();
  if (email) conds.push(sql`lower(${ordersTable.customerEmail}) = ${email}` as any);
  const digits = (who.phone ?? "").replace(/\D/g, "").slice(-9);
  if (digits.length === 9) conds.push(sql`right(regexp_replace(${ordersTable.customerPhone}, '\\D', '', 'g'), 9) = ${digits}` as any);
  if (conds.length === 0) return false;
  const [r] = await db
    .select({ c: sql<number>`cast(count(*) as int)` })
    .from(ordersTable)
    .where(and(or(...conds), ne(ordersTable.status, "cancelled")));
  return (r?.c ?? 0) > 0;
}

// Atomically mark a code used by an order (inside the order's transaction).
// Returns false if someone else used it a moment earlier.
export async function claimCode(tx: any, code: string, orderId: number): Promise<boolean> {
  const rows = await tx
    .update(newsletterSignupsTable)
    .set({ usedAt: new Date(), usedOrderId: orderId })
    .where(and(eq(newsletterSignupsTable.code, code), isNull(newsletterSignupsTable.usedAt)))
    .returning({ id: newsletterSignupsTable.id });
  return rows.length > 0;
}

// A cancelled order gives its code back so the customer can use it again.
export async function releaseCodeForOrder(orderId: number): Promise<void> {
  await db
    .update(newsletterSignupsTable)
    .set({ usedAt: null, usedOrderId: null })
    .where(eq(newsletterSignupsTable.usedOrderId, orderId));
}
