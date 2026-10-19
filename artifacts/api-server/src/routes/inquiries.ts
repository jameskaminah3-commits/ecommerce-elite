import { Router, type IRouter, type Request } from "express";
import { logger } from "../lib/logger";
import { adminRecipients } from "../lib/orderNotifications";
import { sendAdminInquiryEmail } from "../lib/email";
import { parseContactPhones } from "../lib/phone";

const router: IRouter = Router();

// Small per-visitor limit so the forms can't be used to flood the team's inbox.
const hits = new Map<string, number[]>();
function allowed(req: Request, max: number, windowMs: number): boolean {
  const key = `${req.path}:${req.ip}`;
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) return false;
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) hits.clear();
  return true;
}

const text = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
const tel = (raw: string) => {
  const p = parseContactPhones(raw)[0];
  return p ? `<a href="tel:${p.e164}" style="color:#e8430f;">${p.display}</a> · <a href="https://wa.me/${p.msisdn}" style="color:#1da851;">WhatsApp</a>` : raw.replace(/[<>&"]/g, "");
};

// A shopper tapped "Order on WhatsApp": tell the team what they're about to ask
// for, so nothing is missed even if the chat gets buried.
router.post("/inquiries/whatsapp", async (req, res): Promise<void> => {
  res.status(202).json({ ok: true }); // never make the shopper wait
  if (!allowed(req, 8, 10 * 60_000)) return;
  try {
    const b = (req.body ?? {}) as Record<string, unknown>;
    const items = (Array.isArray(b["items"]) ? (b["items"] as Record<string, unknown>[]) : []).slice(0, 30).map((i) => ({
      name: text(i["name"], 160),
      detail: [text(i["option"], 60), Number(i["quantity"]) > 0 ? `× ${Math.min(999, Math.floor(Number(i["quantity"])))}` : ""].filter(Boolean).join(" "),
      amount: Number.isFinite(Number(i["amount"])) ? Math.max(0, Number(i["amount"])) : undefined,
    })).filter((i) => i.name);
    if (items.length === 0) return;
    const total = Number.isFinite(Number(b["total"])) ? Math.max(0, Number(b["total"])) : undefined;
    const name = text(b["customerName"], 120);
    const phone = text(b["customerPhone"], 40);
    const town = text(b["deliveryTown"], 80);
    const page = text(b["url"], 300);
    const rows: [string, string][] = [["Where", text(b["source"], 40) || "Website"]];
    if (name) rows.push(["Customer", name.replace(/[<>&"]/g, "")]);
    if (phone) rows.push(["Phone", tel(phone)]);
    if (town) rows.push(["Deliver to", town.replace(/[<>&"]/g, "")]);
    await sendAdminInquiryEmail(await adminRecipients(), {
      subject: `WhatsApp order started${total != null ? ` — KES ${Math.round(total).toLocaleString("en-KE")}` : ""}${name ? ` · ${name}` : ""}`,
      heading: "A customer is ordering on WhatsApp",
      intro: "They tapped “Order on WhatsApp” with these items. Look out for their message and reply quickly.",
      rows,
      items,
      total,
      actionUrl: /^https?:\/\//.test(page) ? page : undefined,
      actionLabel: "View the page they were on",
    });
  } catch (err) {
    logger.error({ err }, "WhatsApp inquiry email failed");
  }
});

// Contact page form → the team's inbox (reply goes straight to the customer).
router.post("/inquiries/contact", async (req, res): Promise<void> => {
  const b = (req.body ?? {}) as Record<string, unknown>;
  if (text(b["website"], 100)) {
    res.json({ ok: true }); // honeypot filled → a bot; pretend success
    return;
  }
  const name = text(b["name"], 120);
  const phone = text(b["phone"], 40);
  const email = text(b["email"], 200).toLowerCase();
  const message = typeof b["message"] === "string" ? b["message"].trim().slice(0, 3000) : "";
  if (!name || (!phone && !email) || message.length < 3) {
    res.status(400).json({ error: "Please add your name, a phone number or email, and your message." });
    return;
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: "Please check your email address." });
    return;
  }
  if (!allowed(req, 5, 30 * 60_000)) {
    res.status(429).json({ error: "Thanks — we've got your messages. Please give us a moment to reply." });
    return;
  }
  const rows: [string, string][] = [["Name", name.replace(/[<>&"]/g, "")]];
  if (phone) rows.push(["Phone", tel(phone)]);
  if (email) rows.push(["Email", email.replace(/[<>&"]/g, "")]);
  const sent = await sendAdminInquiryEmail(await adminRecipients(), {
    subject: `New message from ${name}`,
    heading: "New customer message",
    rows,
    message,
    replyTo: email || undefined,
  });
  if (!sent) {
    // Don't pretend it arrived — the customer should reach us another way.
    logger.warn("Contact message could not be emailed (is RESEND_API_KEY set?)");
    res.status(503).json({ error: "We couldn't send your message just now. Please WhatsApp or call us instead." });
    return;
  }
  res.status(201).json({ ok: true });
});

export default router;
