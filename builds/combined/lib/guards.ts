import { NextResponse } from "next/server";

// Defense-in-depth guards: per-IP sliding-window rate limiting, bot honeypot check,
// reserved usernames, and safe relative redirect validation (REQ-C09, from Build B + Build A).

const RESERVED_USERNAMES = new Set([
  "admin",
  "administrator",
  "root",
  "system",
  "support",
  "security",
  "moderator",
  "api",
  "null",
  "undefined",
]);

export function isReservedUsername(username: string): boolean {
  return RESERVED_USERNAMES.has(username.trim().toLowerCase());
}

export function isBotHoneypotTriggered(honeypotValue: unknown): boolean {
  return typeof honeypotValue === "string" && honeypotValue.trim().length > 0;
}

type BucketMap = Map<string, number[]>;

declare global {
  var __siCombinedRateBuckets: BucketMap | undefined;
}

export function checkRateLimit(key: string, maxHits = 25, windowMs = 600_000): boolean {
  globalThis.__siCombinedRateBuckets ??= new Map<string, number[]>();
  const buckets = globalThis.__siCombinedRateBuckets;
  const now = Date.now();
  const prev = (buckets.get(key) ?? []).filter((ts) => now - ts < windowMs);
  if (prev.length >= maxHits) {
    buckets.set(key, prev);
    return false;
  }
  prev.push(now);
  if (buckets.size > 4000) buckets.clear();
  buckets.set(key, prev);
  return true;
}

export function clientIpFromRequest(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "local";
}

// Prevents open redirects: allows only local paths starting with `/` and never `//` or `/\`
export function safeReturnPath(raw: FormDataEntryValue | string | null | undefined, fallback = "/"): string {
  if (typeof raw !== "string") return fallback;
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.startsWith("/\\")) {
    return fallback;
  }
  return trimmed.slice(0, 300);
}

export function redirectTo(request: Request, path: string, status: 302 | 303 = 303): NextResponse {
  const safe = safeReturnPath(path, "/");
  return NextResponse.redirect(new URL(safe, request.url), { status });
}

export function prefersJsonResponse(request: Request): boolean {
  const accept = request.headers.get("accept") ?? "";
  const contentType = request.headers.get("content-type") ?? "";
  return contentType.includes("application/json") || (accept.includes("application/json") && !accept.includes("text/html"));
}
