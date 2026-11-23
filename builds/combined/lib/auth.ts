import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { ensureSchema, S, sql } from "./db";
import { isReservedUsername } from "./guards";
import { EmailSchema } from "./limits";

// Safe Accounts & Persistent Sessions (REQ-009..REQ-012, AT-07..AT-09).
// Adopts Build A's salted scrypt + constant-time anti-enumeration login + SHA-256 hashed session tokens,
// combined with Build B's reserved-username guard.

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number },
) => Promise<Buffer>;

const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 };
const KEY_LENGTH = 64;
export const SESSION_COOKIE = "si_session";
export const SESSION_DAYS = 30;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, KEY_LENGTH, SCRYPT_PARAMS);
  return `scrypt$${SCRYPT_PARAMS.N}$${SCRYPT_PARAMS.r}$${SCRYPT_PARAMS.p}$${salt.toString("hex")}$${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, n, r, p, saltHex, keyHex] = stored.split("$");
  if (scheme !== "scrypt" || !saltHex || !keyHex) return false;
  const expected = Buffer.from(keyHex, "hex");
  const actual = await scrypt(password, Buffer.from(saltHex, "hex"), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
  });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function validateUsername(username: string): string | null {
  const trimmed = username.trim();
  if (!/^[A-Za-z0-9_-]{3,30}$/.test(trimmed)) {
    return "Username must be 3 to 30 characters using letters, numbers, underscores or hyphens.";
  }
  if (isReservedUsername(trimmed)) {
    return "That username is reserved. Please choose another.";
  }
  return null;
}

export function validatePassword(password: string): string | null {
  if (typeof password !== "string" || password.length < 8) {
    return "Password must be at least 8 characters.";
  }
  if (password.length > 200) {
    return "Password must be 200 characters or fewer.";
  }
  return null;
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSessionForUser(userId: string): Promise<string> {
  await ensureSchema();
  const rawToken = randomBytes(32).toString("base64url");
  const tokenHash = hashSessionToken(rawToken);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);

  await sql`DELETE FROM ${S()}.sessions WHERE user_id = ${userId} AND expires_at < now()`;
  await sql`
    INSERT INTO ${S()}.sessions (token_hash, user_id, expires_at)
    VALUES (${tokenHash}, ${userId}, ${expiresAt})
  `;

  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, rawToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  });

  return rawToken;
}

export type SessionUser = {
  id: string;
  username: string;
  tier: "free" | "reviewer";
  hasEmail: boolean;
};

export async function getCurrentUser(): Promise<SessionUser | null> {
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE)?.value;
  if (!rawToken) return null;

  await ensureSchema();
  const tokenHash = hashSessionToken(rawToken);
  const rows = await sql<{ id: string; username: string; tier: string; has_email: boolean }[]>`
    SELECT u.id, u.username, u.tier, (u.email IS NOT NULL) AS has_email
    FROM ${S()}.sessions s
    JOIN ${S()}.users u ON u.id = s.user_id
    WHERE s.token_hash = ${tokenHash} AND s.expires_at > now()
    LIMIT 1
  `;
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    id: String(r.id),
    username: r.username,
    tier: r.tier === "reviewer" ? "reviewer" : "free",
    hasEmail: r.has_email,
  };
}

export async function destroyCurrentSession(): Promise<void> {
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE)?.value;
  if (rawToken) {
    await ensureSchema();
    await sql`DELETE FROM ${S()}.sessions WHERE token_hash = ${hashSessionToken(rawToken)}`;
  }
  cookieStore.delete(SESSION_COOKIE);
}

export type RegisterResult =
  | { ok: true; userId: string; username: string }
  | { ok: false; code: "username" | "password" | "taken" | "email" | "email_taken"; message: string };

export async function registerUser(opts: {
  username: string;
  email: string;
  password: string;
  ipHash: string;
}): Promise<RegisterResult> {
  const username = opts.username.trim();
  const uErr = validateUsername(username);
  if (uErr) return { ok: false, code: "username", message: uErr };
  const parsedEmail = EmailSchema.safeParse(opts.email);
  if (!parsedEmail.success) {
    return { ok: false, code: "email", message: parsedEmail.error.issues[0]?.message ?? "Enter a valid email address." };
  }
  const pErr = validatePassword(opts.password);
  if (pErr) return { ok: false, code: "password", message: pErr };

  await ensureSchema();
  const passwordHash = await hashPassword(opts.password);

  try {
    const [row] = await sql<{ id: string; username: string }[]>`
      INSERT INTO ${S()}.users (username, email, password_hash, signup_ip_hash)
      VALUES (${username}, ${parsedEmail.data}, ${passwordHash}, ${opts.ipHash})
      RETURNING id, username
    `;
    return { ok: true, userId: String(row.id), username: row.username };
  } catch (err) {
    const e = err as { code?: string; constraint_name?: string; message?: string };
    if (e.code === "23505") {
      const isEmail = (e.constraint_name ?? e.message ?? "").includes("email");
      return isEmail
        ? { ok: false, code: "email_taken", message: "An account already uses that email. Sign in instead." }
        : { ok: false, code: "taken", message: "That username is already taken. Please choose another." };
    }
    throw err;
  }
}

// Constant-time anti-enumeration sign-in (User Story 2 Scenario 4 & REQ-011).
export async function verifyCredentials(
  rawUsername: string,
  password: string,
): Promise<{ id: string; username: string } | null> {
  await ensureSchema();
  const username = rawUsername.trim();
  const rows = await sql<{ id: string; username: string; password_hash: string }[]>`
    SELECT id, username, password_hash
    FROM ${S()}.users
    WHERE lower(username) = lower(${username})
    LIMIT 1
  `;
  if (rows.length === 0) {
    await hashPassword(password || "placeholder-password");
    return null;
  }
  const valid = await verifyPassword(password, rows[0].password_hash);
  return valid ? { id: String(rows[0].id), username: rows[0].username } : null;
}
