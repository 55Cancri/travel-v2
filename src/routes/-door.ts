// The site's door: only ALLOWED_EMAILS holders knowing APP_PASSWORD may
// enter, and a successful entry becomes a sealed session cookie. Server
// code only (it reads worker bindings); route handlers and server
// functions are its callers. Login answers identically for an unknown
// email and a wrong password, so the door never confirms which emails
// exist.

import { env } from "cloudflare:workers";

export const SESSION_COOKIE = "travel2-session";
const SESSION_DAYS = 90;
export const SESSION_MAX_AGE_SECONDS = SESSION_DAYS * 24 * 60 * 60;

const encoder = new TextEncoder();

const hmacKey = () =>
  crypto.subtle.importKey(
    "raw",
    encoder.encode(env.SESSION_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );

const b64url = (bytes: ArrayBuffer | Uint8Array) => {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let raw = "";
  for (const byte of view) raw += String.fromCharCode(byte);
  return btoa(raw).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
};

const b64urlBytes = (text: string) => {
  const raw = atob(text.replaceAll("-", "+").replaceAll("_", "/"));
  return Uint8Array.from(raw, (ch) => ch.charCodeAt(0));
};

const allowedEmails = () =>
  (env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

// Both inputs pass through HMAC before comparing, so the comparison
// itself cannot leak how many characters matched.
const matchesSecret = async (offered: string, actual: string) => {
  const key = await hmacKey();
  const offeredMac = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(offered)));
  const actualMac = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(actual)));
  let diff = 0;
  for (let i = 0; i < offeredMac.length; i++) diff |= offeredMac[i] ^ actualMac[i];
  return diff === 0;
};

// Null unless the email is allowed AND the password matches; the caller
// answers the same way for both failures.
export const admit = async (email: string, password: string) => {
  const normalized = email.trim().toLowerCase();
  const passwordOk = await matchesSecret(password, env.APP_PASSWORD);
  if (!passwordOk || !allowedEmails().includes(normalized)) return null;
  return sealSession(normalized);
};

export const sealSession = async (email: string) => {
  const expiresMs = Temporal.Now.instant().epochMilliseconds + SESSION_MAX_AGE_SECONDS * 1000;
  const body = b64url(encoder.encode(`${email}|${expiresMs}`));
  const signature = await crypto.subtle.sign("HMAC", await hmacKey(), encoder.encode(body));
  return `${body}.${b64url(signature)}`;
};

// The email inside a valid, unexpired, still-allowed session; null for
// anything else.
export const openSession = async (token: string | undefined | null) => {
  if (!token) return null;
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  const valid = await crypto.subtle.verify(
    "HMAC",
    await hmacKey(),
    b64urlBytes(signature),
    encoder.encode(body),
  );
  if (!valid) return null;
  const decoded = new TextDecoder().decode(b64urlBytes(body));
  const splitAt = decoded.lastIndexOf("|");
  if (splitAt < 0) return null;
  const email = decoded.slice(0, splitAt);
  const expiresMs = Number(decoded.slice(splitAt + 1));
  if (!Number.isFinite(expiresMs) || Temporal.Now.instant().epochMilliseconds > expiresMs) {
    return null;
  }
  return allowedEmails().includes(email) ? email : null;
};

// The session email carried by a raw Request, for API route handlers.
export const sessionFromRequest = (request: Request) => {
  const cookies = request.headers.get("cookie") ?? "";
  const pair = cookies
    .split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${SESSION_COOKIE}=`));
  return openSession(pair ? decodeURIComponent(pair.slice(SESSION_COOKIE.length + 1)) : null);
};
