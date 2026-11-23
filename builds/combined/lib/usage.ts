import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { ensureSchema, S, sql } from "@/lib/db";
import { clientIpFromRequest } from "@/lib/guards";
import {
  ACTION_LABEL,
  AI_UNIT_COST,
  limitFor,
  readSpendSettings,
  type MeteredAction,
  type SignupVelocity,
  type Tier,
} from "@/lib/limits";
import type { SessionUser } from "@/lib/auth";

// IPs are only ever stored as a salted SHA-256 digest so repeat sign-ups can be watched without keeping raw addresses.
export function hashIp(ip: string): string {
  const salt = process.env.CRON_SECRET || "si-combined-ip-salt";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}

export function actorFor(user: SessionUser | null, request: Request): { actor: string; tier: Tier } {
  if (user) return { actor: `u:${user.id}`, tier: user.tier };
  return { actor: `ip:${hashIp(clientIpFromRequest(request))}`, tier: "anonymous" };
}

export type QuotaResult =
  | { ok: true; usedToday: number; limit: number }
  | { ok: false; usedToday: number; limit: number; message: string; status: 403 | 429 };

export async function consumeQuota(opts: {
  actor: string;
  tier: Tier;
  action: MeteredAction;
}): Promise<QuotaResult> {
  const limit = limitFor(opts.tier, opts.action);
  if (limit.perDay === 0) {
    return {
      ok: false,
      usedToday: 0,
      limit: 0,
      status: 403,
      message:
        opts.tier === "anonymous"
          ? `${ACTION_LABEL[opts.action]} need a free account.`
          : `${ACTION_LABEL[opts.action]} are not available on this tier.`,
    };
  }

  await ensureSchema();
  const [row] = await sql<{ day: number; minute: number }[]>`
    SELECT
      count(*) FILTER (WHERE created_at > now() - interval '1 day')::int AS day,
      count(*) FILTER (WHERE created_at > now() - interval '1 minute')::int AS minute
    FROM ${S()}.usage_events
    WHERE actor = ${opts.actor} AND action = ${opts.action} AND created_at > now() - interval '1 day'
  `;
  const day = row?.day ?? 0;
  const minute = row?.minute ?? 0;

  if (minute >= limit.perMinute) {
    return { ok: false, usedToday: day, limit: limit.perDay, status: 429, message: "Slow down — too many requests this minute." };
  }
  if (day >= limit.perDay) {
    return {
      ok: false,
      usedToday: day,
      limit: limit.perDay,
      status: 429,
      message: `Daily limit reached for ${ACTION_LABEL[opts.action].toLowerCase()} (${limit.perDay}/day). It resets on a rolling 24-hour window.`,
    };
  }

  await sql`INSERT INTO ${S()}.usage_events (actor, action) VALUES (${opts.actor}, ${opts.action})`;
  return { ok: true, usedToday: day + 1, limit: limit.perDay };
}

export function quotaErrorResponse(q: Extract<QuotaResult, { ok: false }>): Response {
  return NextResponse.json(
    { error: q.message, usedToday: q.usedToday, limit: q.limit },
    { status: q.status, headers: q.status === 429 ? { "Retry-After": "60" } : undefined },
  );
}

// Global AI spend ceiling: reserves units atomically-enough for a single cron writer.
export async function reserveAiUnits(tier: 1 | 2): Promise<boolean> {
  const settings = readSpendSettings();
  if (!settings.aiEnabled) return false;
  if (tier === 2 && !settings.allowTier2Escalation) return false;
  const cost = tier === 2 ? AI_UNIT_COST.tier2 : AI_UNIT_COST.tier1;

  await ensureSchema();
  const [row] = await sql<{ used: number }[]>`
    SELECT COALESCE(sum(cost_units), 0)::int AS used
    FROM ${S()}.usage_events
    WHERE action = 'ai_judge' AND created_at > now() - interval '1 day'
  `;
  if ((row?.used ?? 0) + cost > settings.dailyAiUnitCap) return false;
  await sql`INSERT INTO ${S()}.usage_events (actor, action, cost_units) VALUES ('system', 'ai_judge', ${cost})`;
  return true;
}

export async function getUsageSnapshot(actor: string): Promise<{
  perAction: Partial<Record<MeteredAction, number>>;
  aiUnitsToday: number;
}> {
  await ensureSchema();
  const rows = await sql<{ action: MeteredAction; n: number }[]>`
    SELECT action, count(*)::int AS n
    FROM ${S()}.usage_events
    WHERE actor = ${actor} AND created_at > now() - interval '1 day'
    GROUP BY action
  `;
  const [ai] = await sql<{ used: number }[]>`
    SELECT COALESCE(sum(cost_units), 0)::int AS used
    FROM ${S()}.usage_events
    WHERE action = 'ai_judge' AND created_at > now() - interval '1 day'
  `;
  return {
    perAction: Object.fromEntries(rows.map((r) => [r.action, r.n])),
    aiUnitsToday: ai?.used ?? 0,
  };
}

export async function getSignupVelocity(ipHash: string): Promise<SignupVelocity> {
  await ensureSchema();
  const [row] = await sql<SignupVelocity[]>`
    SELECT
      count(*) FILTER (WHERE ip_hash = ${ipHash} AND outcome = 'created' AND created_at > now() - interval '1 hour')::int AS "ipLastHour",
      count(*) FILTER (WHERE ip_hash = ${ipHash} AND outcome = 'created' AND created_at > now() - interval '1 day')::int AS "ipLastDay",
      count(*) FILTER (WHERE ip_hash = ${ipHash} AND outcome = 'created' AND created_at > now() - interval '7 days')::int AS "ipLastWeek",
      count(*) FILTER (WHERE outcome = 'created' AND created_at > now() - interval '10 minutes')::int AS "globalLast10Min"
    FROM ${S()}.signup_events
    WHERE created_at > now() - interval '7 days'
  `;
  return row ?? { ipLastHour: 0, ipLastDay: 0, ipLastWeek: 0, globalLast10Min: 0 };
}

export async function recordSignupEvent(opts: {
  ipHash: string;
  outcome: "created" | "rejected" | "throttled" | "blocked" | "bot";
  reason?: string;
  emailDomain?: string | null;
}): Promise<void> {
  await ensureSchema();
  await sql`
    INSERT INTO ${S()}.signup_events (ip_hash, outcome, reason, email_domain)
    VALUES (${opts.ipHash}, ${opts.outcome}, ${(opts.reason ?? "").slice(0, 160)}, ${opts.emailDomain ?? null})
  `;
}

export type WatchedNetwork = {
  ipHash: string;
  created: number;
  refused: number;
  domains: string[];
  lastSeen: Date;
};

// Networks with repeated sign-ups in the last 7 days, for the operator watch list on /limits.
export async function getWatchedNetworks(minCreated = 2): Promise<WatchedNetwork[]> {
  await ensureSchema();
  const rows = await sql<{ ip_hash: string; created: number; refused: number; domains: string[]; last_seen: Date }[]>`
    SELECT
      ip_hash,
      count(*) FILTER (WHERE outcome = 'created')::int AS created,
      count(*) FILTER (WHERE outcome <> 'created')::int AS refused,
      COALESCE(array_agg(DISTINCT email_domain) FILTER (WHERE email_domain IS NOT NULL), '{}') AS domains,
      max(created_at) AS last_seen
    FROM ${S()}.signup_events
    WHERE created_at > now() - interval '7 days'
    GROUP BY ip_hash
    HAVING count(*) FILTER (WHERE outcome = 'created') >= ${minCreated} OR count(*) FILTER (WHERE outcome <> 'created') >= 3
    ORDER BY created DESC, refused DESC
    LIMIT 25
  `;
  return rows.map((r) => ({
    ipHash: r.ip_hash.slice(0, 10),
    created: r.created,
    refused: r.refused,
    domains: r.domains.slice(0, 4),
    lastSeen: new Date(r.last_seen),
  }));
}
