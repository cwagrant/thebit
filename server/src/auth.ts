import crypto from "node:crypto";
import { Request, Response, NextFunction } from "express";
import { deriveKey } from "./secrets.js";

// Optional admin login. With THEBIT_ADMIN_PASSWORD set, everything under
// /api needs a session cookie (apart from the routes index.ts mounts ahead
// of requireAdmin - logging in, and the invite page's own endpoints).
// Without it the app stays open, as it always was - fine on a trusted LAN,
// not something to put behind a public tunnel.

const SESSION_COOKIE = "thebit_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const FAILED_LOGIN_DELAY_MS = 1000;

function adminPassword(): string | undefined {
  return process.env.THEBIT_ADMIN_PASSWORD || undefined;
}

export function authRequired(): boolean {
  return adminPassword() !== undefined;
}

function digest(value: string): Buffer {
  return crypto.createHash("sha256").update(value).digest();
}

// Salted with the password, so changing it signs everyone out.
function sign(payload: string): string {
  const key = deriveKey("session-cookie", digest(adminPassword() || "").toString("hex"));

  return crypto.createHmac("sha256", key).update(payload).digest("base64url");
}

function readCookie(req: Request, name: string): string | undefined {
  for (const pair of (req.headers.cookie || "").split(";")) {
    const index = pair.indexOf("=");

    if (index > 0 && pair.slice(0, index).trim() === name)
      return pair.slice(index + 1).trim();
  }

  return undefined;
}

export function isAuthenticated(req: Request): boolean {
  if (!authRequired())
    return true;

  const [expiresAt, signature] = (readCookie(req, SESSION_COOKIE) || "").split(".");

  if (!expiresAt || !signature)
    return false;

  const expected = Buffer.from(sign(expiresAt));
  const given = Buffer.from(signature);

  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given))
    return false;

  return Number(expiresAt) > Date.now();
}

function sessionCookie(req: Request, value: string, maxAgeMs: number): string {
  // Behind a TLS-terminating tunnel/proxy the request itself arrives as http.
  const secure = req.secure || req.headers["x-forwarded-proto"] === "https";

  return `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(maxAgeMs / 1000)}${secure ? "; Secure" : ""}`;
}

export async function login(req: Request, res: Response): Promise<boolean> {
  const expected = adminPassword();
  const given = typeof req.body?.password === "string" ? req.body.password : "";

  if (expected === undefined)
    return true;

  if (!crypto.timingSafeEqual(digest(expected), digest(given))) {
    // Flat delay on every wrong guess - crude, but enough to make guessing
    // a decent password over the network impractical.
    await new Promise((resolve) => setTimeout(resolve, FAILED_LOGIN_DELAY_MS));
    return false;
  }

  const expiresAt = String(Date.now() + SESSION_TTL_MS);

  res.setHeader("Set-Cookie", sessionCookie(req, `${expiresAt}.${sign(expiresAt)}`, SESSION_TTL_MS));

  return true;
}

export function logout(req: Request, res: Response): void {
  res.setHeader("Set-Cookie", sessionCookie(req, "", 0));
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (isAuthenticated(req))
    return next();

  res.sendStatus(401);
}
