import type { Response } from "express";

const SESSION_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

// In production the storefront and API are typically served from different
// origins, which requires SameSite=None + Secure for the cookie to be sent on
// cross-site requests. In development we keep Lax so it works over plain HTTP.
export function sessionCookieOptions() {
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

// Sets the signed session cookie that getUserId() reads back. Centralised so
// password, Google, and OTP logins all issue an identical session.
export function setSessionCookie(res: Response, userId: number): void {
  res.cookie("userId", String(userId), sessionCookieOptions());
}

// Where to send the browser after a redirect-based login (Google). Falls back
// to the API origin's root if unset.
export function storefrontUrl(): string {
  return (process.env["STOREFRONT_URL"] ?? "").replace(/\/+$/, "") || "/";
}
