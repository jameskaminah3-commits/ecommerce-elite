import { logger } from "./logger";

// Google OAuth 2.0 (Authorization Code flow). Uses fetch directly — no SDK.
//
// Required env:
//   GOOGLE_CLIENT_ID
//   GOOGLE_CLIENT_SECRET
//   GOOGLE_REDIRECT_URI    — must exactly match an Authorized redirect URI in the
//                            Google Cloud console, e.g.
//                            https://api.happyfine.co.ke/api/auth/google/callback

export function isGoogleConfigured(): boolean {
  return Boolean(
    process.env["GOOGLE_CLIENT_ID"] &&
      process.env["GOOGLE_CLIENT_SECRET"] &&
      process.env["GOOGLE_REDIRECT_URI"],
  );
}

export function buildAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env["GOOGLE_CLIENT_ID"]!,
    redirect_uri: process.env["GOOGLE_REDIRECT_URI"]!,
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
    prompt: "select_account",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export interface GoogleProfile {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string;
  picture?: string;
}

export async function exchangeCodeForProfile(code: string): Promise<GoogleProfile> {
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env["GOOGLE_CLIENT_ID"]!,
      client_secret: process.env["GOOGLE_CLIENT_SECRET"]!,
      redirect_uri: process.env["GOOGLE_REDIRECT_URI"]!,
      grant_type: "authorization_code",
    }),
  });
  const token = (await tokenRes.json().catch(() => ({}))) as any;
  if (!tokenRes.ok || !token?.access_token) {
    logger.error({ status: tokenRes.status, token }, "Google token exchange failed");
    throw new Error("Google token exchange failed");
  }

  const infoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  const info = (await infoRes.json().catch(() => ({}))) as any;
  if (!infoRes.ok || !info?.sub || !info?.email) {
    logger.error({ status: infoRes.status, info }, "Google userinfo fetch failed");
    throw new Error("Google userinfo fetch failed");
  }

  return {
    sub: String(info.sub),
    email: String(info.email),
    emailVerified: Boolean(info.email_verified),
    name: String(info.name ?? info.email.split("@")[0]),
    picture: info.picture ? String(info.picture) : undefined,
  };
}
