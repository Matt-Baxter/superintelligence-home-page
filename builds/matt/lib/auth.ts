import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { sql } from "./db";

// Accounts and sessions with Node's built-in crypto; no auth library. (REQ-009 to REQ-012)

const scrypt = promisify(scryptCb) as (password: string, salt: Buffer, keylen: number, options: { N: number; r: number; p: number }) => Promise<Buffer>;

const SCRYPT = { N: 16384, r: 8, p: 1 };
const KEY_LENGTH = 64;
export const SESSION_COOKIE = "session";
const SESSION_DAYS = 30;

// --- Passwords (REQ-011): stored only as a salted scrypt hash, never in readable form. ---

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, KEY_LENGTH, SCRYPT);
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString("hex")}$${key.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, n, r, p, saltHex, keyHex] = stored.split("$");
  if (scheme !== "scrypt" || !saltHex || !keyHex) return false;
  const expected = Buffer.from(keyHex, "hex");
  const actual = await scrypt(password, Buffer.from(saltHex, "hex"), expected.length, { N: Number(n), r: Number(r), p: Number(p) });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

// --- Validation (REQ-009): "3–30 characters: letters, numbers, `_`, `-`" ---

export function validateUsername(username: string): string | null {
  return /^[A-Za-z0-9_-]{3,30}$/.test(username)
    ? null
    : "Username must be 3 to 30 characters: letters, numbers, underscores or hyphens.";
}

export function validatePassword(password: string): string | null {
  return password.length >= 8 ? null : "Password must be at least 8 characters.";
}

// --- Sessions (REQ-010): random token in an httpOnly cookie; only its SHA-256 hash is stored. ---

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await sql`DELETE FROM sessions WHERE user_id = ${userId} AND expires_at < now()`;
  await sql`INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (${hashToken(token)}, ${userId}, ${expires})`;
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  });
}

export type CurrentUser = { id: string; username: string };

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const rows = await sql<{ id: string; username: string }[]>`
    SELECT u.id, u.username FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ${hashToken(token)} AND s.expires_at > now()`;
  return rows.length ? { id: String(rows[0].id), username: rows[0].username } : null;
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await sql`DELETE FROM sessions WHERE token_hash = ${hashToken(token)}`;
  }
  store.delete(SESSION_COOKIE);
}

// --- Accounts ---

export type SignUpResult = { ok: true; userId: string } | { ok: false; error: "taken" | "username" | "password" };

export async function signUp(username: string, password: string): Promise<SignUpResult> {
  if (validateUsername(username)) return { ok: false, error: "username" };
  if (validatePassword(password)) return { ok: false, error: "password" };
  const hash = await hashPassword(password);
  try {
    const [row] = await sql<{ id: string }[]>`
      INSERT INTO users (username, password_hash) VALUES (${username}, ${hash}) RETURNING id`;
    return { ok: true, userId: String(row.id) };
  } catch (err) {
    // 23505: unique violation on lower(username)
    if ((err as { code?: string }).code === "23505") return { ok: false, error: "taken" };
    throw err;
  }
}

// Returns the user ID, or null. The caller shows the same message whether the username is
// unknown or the password is wrong (User Story 2, scenario 4).
export async function checkSignIn(username: string, password: string): Promise<string | null> {
  const rows = await sql<{ id: string; password_hash: string }[]>`
    SELECT id, password_hash FROM users WHERE lower(username) = lower(${username})`;
  if (rows.length === 0) {
    // Spend about the same time as a real check, so timing doesn't reveal unknown usernames.
    await hashPassword(password);
    return null;
  }
  return (await verifyPassword(password, rows[0].password_hash)) ? String(rows[0].id) : null;
}
