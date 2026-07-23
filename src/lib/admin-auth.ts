import { createHmac, timingSafeEqual } from "crypto";

const COOKIE_NAME = "pumprobin_admin_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 12;

function getAdminPassword(): string {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) throw new Error("ADMIN_PASSWORD is not configured");
  return password;
}

function getSessionSecret(): string {
  return (
    process.env.ADMIN_SESSION_SECRET ||
    process.env.ADMIN_PASSWORD ||
    "pumprobin-dev-secret"
  );
}

export function isAdminPasswordConfigured(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD);
}

export function verifyAdminPassword(input: string): boolean {
  try {
    const expected = getAdminPassword();
    const a = Buffer.from(input);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function createAdminSessionToken(): string {
  const exp = Date.now() + SESSION_TTL_MS;
  const payload = `admin:${exp}`;
  const sig = createHmac("sha256", getSessionSecret())
    .update(payload)
    .digest("hex");
  return `${payload}.${sig}`;
}

export function verifyAdminSessionToken(
  token: string | undefined | null
): boolean {
  if (!token) return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;
  const expected = createHmac("sha256", getSessionSecret())
    .update(payload)
    .digest("hex");
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  } catch {
    return false;
  }
  const exp = Number(payload.split(":")[1]);
  return Number.isFinite(exp) && Date.now() <= exp;
}

export function getAdminCookieName() {
  return COOKIE_NAME;
}

export function adminCookieOptions(maxAgeSeconds = SESSION_TTL_MS / 1000) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}
