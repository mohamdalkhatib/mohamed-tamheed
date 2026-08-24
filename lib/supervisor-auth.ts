import { appEnv, ensureDatabase } from "@/db/core";

const COOKIE_NAME = "tamheed_supervisor";
const SESSION_SECONDS = 60 * 60 * 12;

function fromBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

function toBase64Url(value: Uint8Array) {
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function hashToken(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return toBase64Url(new Uint8Array(digest));
}

function safeEqual(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) mismatch |= left[index] ^ right[index];
  return mismatch === 0;
}

export async function verifySupervisorPassword(password: string) {
  const encoded = appEnv().SUPERVISOR_PASSWORD_HASH;
  if (!encoded) throw new Error("بيانات المشرف غير مضبوطة على الخادم.");
  const [version, iterationsValue, saltValue, expectedValue] = encoded.split(":");
  if (version !== "v1" || !iterationsValue || !saltValue || !expectedValue) return false;
  const iterations = Number(iterationsValue);
  if (!Number.isSafeInteger(iterations) || iterations < 100_000) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const derived = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: fromBase64Url(saltValue), iterations },
    key,
    256,
  );
  return safeEqual(new Uint8Array(derived), fromBase64Url(expectedValue));
}

export async function createSupervisorSession() {
  const db = await ensureDatabase();
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const token = toBase64Url(bytes);
  const tokenHash = await hashToken(token);
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + SESSION_SECONDS;
  await db.batch([
    db.prepare("DELETE FROM supervisor_sessions WHERE expires_at < ?").bind(now),
    db.prepare("INSERT INTO supervisor_sessions (token_hash, expires_at) VALUES (?, ?)").bind(tokenHash, expiresAt),
  ]);
  return { token, expiresAt };
}

function cookieValue(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  if (authorization.startsWith("Bearer ")) return authorization.slice(7).trim() || null;
  const cookie = request.headers.get("cookie") ?? "";
  for (const part of cookie.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === COOKIE_NAME) return rest.join("=");
  }
  return null;
}

export async function isSupervisor(request: Request) {
  const token = cookieValue(request);
  if (!token) return false;
  const db = await ensureDatabase();
  const tokenHash = await hashToken(token);
  const result = await db
    .prepare("SELECT token_hash FROM supervisor_sessions WHERE token_hash = ? AND expires_at > ?")
    .bind(tokenHash, Math.floor(Date.now() / 1000))
    .first();
  return Boolean(result);
}

export async function destroySupervisorSession(request: Request) {
  const token = cookieValue(request);
  if (!token) return;
  const db = await ensureDatabase();
  await db.prepare("DELETE FROM supervisor_sessions WHERE token_hash = ?").bind(await hashToken(token)).run();
}

export function sessionCookie(request: Request, token: string, expiresAt: number) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${Math.max(0, expiresAt - Math.floor(Date.now() / 1000))}${secure}`;
}

export function expiredSessionCookie(request: Request) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`;
}
