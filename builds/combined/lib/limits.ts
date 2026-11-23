import { z } from "zod";

// Single source of truth for what each tier may do, and for the operator's spend ceilings.
// Pure module (no DB) so pages, routes and tests all read the same numbers.

export const MeteredActionSchema = z.enum([
  "analyze",
  "vote",
  "save",
  "review_verdict",
  "review_flag",
  "export",
  "harvest_manual",
  "ai_judge",
]);
export type MeteredAction = z.infer<typeof MeteredActionSchema>;

export const TierSchema = z.enum(["anonymous", "free", "reviewer"]);
export type Tier = z.infer<typeof TierSchema>;

export type ActionLimit = { perDay: number; perMinute: number };

export const ACTION_LABEL: Record<MeteredAction, string> = {
  analyze: "Live paper analyses",
  vote: "Votes",
  save: "Saves",
  review_verdict: "Review verdicts",
  review_flag: "Flags for review",
  export: "JSON / Atom exports",
  harvest_manual: "Manual harvests",
  ai_judge: "AI judge calls (system)",
};

// 0 = not available on that tier. Free accounts get the full reader + reviewer toolset;
// anonymous visitors keep read access plus a small analysis allowance.
export const TIER_LIMITS: Record<Tier, Partial<Record<MeteredAction, ActionLimit>>> = {
  anonymous: {
    analyze: { perDay: 5, perMinute: 2 },
    export: { perDay: 30, perMinute: 6 },
  },
  free: {
    analyze: { perDay: 40, perMinute: 6 },
    vote: { perDay: 300, perMinute: 30 },
    save: { perDay: 300, perMinute: 30 },
    review_verdict: { perDay: 60, perMinute: 10 },
    review_flag: { perDay: 20, perMinute: 5 },
    export: { perDay: 200, perMinute: 20 },
  },
  reviewer: {
    analyze: { perDay: 200, perMinute: 15 },
    vote: { perDay: 1000, perMinute: 60 },
    save: { perDay: 1000, perMinute: 60 },
    review_verdict: { perDay: 400, perMinute: 30 },
    review_flag: { perDay: 100, perMinute: 15 },
    export: { perDay: 1000, perMinute: 60 },
    harvest_manual: { perDay: 6, perMinute: 1 },
  },
};

export const TIER_LABEL: Record<Tier, string> = {
  anonymous: "Visitor",
  free: "Free account",
  reviewer: "Reviewer",
};

export function limitFor(tier: Tier, action: MeteredAction): ActionLimit {
  return TIER_LIMITS[tier][action] ?? { perDay: 0, perMinute: 0 };
}

// Operator spend controls. Read from env so they can be tightened without a deploy of code.
export const SpendSettingsSchema = z.object({
  aiEnabled: z.boolean(),
  allowTier2Escalation: z.boolean(),
  dailyAiUnitCap: z.number().int().min(0).max(1_000_000),
  maxJudgePerHarvest: z.number().int().min(0).max(500),
  maxItemsPerSource: z.number().int().min(1).max(100),
  manualHarvestCooldownMin: z.number().int().min(1).max(1440),
});
export type SpendSettings = z.infer<typeof SpendSettingsSchema>;

// Relative cost of one call. Tier 2 models cost several times a Tier 1 call.
export const AI_UNIT_COST = { tier1: 1, tier2: 4 } as const;

function intEnv(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function boolEnv(name: string, fallback: boolean): boolean {
  const raw = process.env[name]?.toLowerCase();
  if (raw === "true" || raw === "1") return true;
  if (raw === "false" || raw === "0") return false;
  return fallback;
}

export function readSpendSettings(): SpendSettings {
  return SpendSettingsSchema.parse({
    aiEnabled: boolEnv("SPEND_AI_ENABLED", true),
    allowTier2Escalation: boolEnv("SPEND_ALLOW_TIER2", true),
    dailyAiUnitCap: Math.min(intEnv("SPEND_DAILY_AI_UNITS", 600), 1_000_000),
    maxJudgePerHarvest: Math.min(intEnv("SPEND_MAX_JUDGE_PER_HARVEST", 40), 500),
    maxItemsPerSource: Math.min(Math.max(intEnv("HARVEST_MAX_ITEMS_PER_SOURCE", 30), 1), 100),
    manualHarvestCooldownMin: Math.min(Math.max(intEnv("HARVEST_MANUAL_COOLDOWN_MIN", 30), 1), 1440),
  });
}

export const SPEND_SETTING_DOCS: { env: string; label: string; key: keyof SpendSettings }[] = [
  { env: "SPEND_AI_ENABLED", label: "AI judging enabled (false = deterministic scoring only)", key: "aiEnabled" },
  { env: "SPEND_ALLOW_TIER2", label: "Allow escalation to the larger Tier 2 model", key: "allowTier2Escalation" },
  { env: "SPEND_DAILY_AI_UNITS", label: "Daily AI unit ceiling (Tier 1 = 1 unit, Tier 2 = 4)", key: "dailyAiUnitCap" },
  { env: "SPEND_MAX_JUDGE_PER_HARVEST", label: "Max stories judged per harvest run", key: "maxJudgePerHarvest" },
  { env: "HARVEST_MAX_ITEMS_PER_SOURCE", label: "Max items read per source per run", key: "maxItemsPerSource" },
  { env: "HARVEST_MANUAL_COOLDOWN_MIN", label: "Minutes between manual harvests", key: "manualHarvestCooldownMin" },
];

// Sign-up velocity policy (per salted IP hash and global).
export const SIGNUP_POLICY = {
  perIpPerHour: 3,
  perIpPerDay: 5,
  globalPer10Min: 40,
  watchThresholdPerWeek: 3,
} as const;

export type SignupVelocity = { ipLastHour: number; ipLastDay: number; ipLastWeek: number; globalLast10Min: number };

export type SignupDecision =
  | { allow: true; watch: boolean }
  | { allow: false; outcome: "throttled" | "blocked"; reason: string };

export function decideSignup(v: SignupVelocity): SignupDecision {
  if (v.globalLast10Min >= SIGNUP_POLICY.globalPer10Min) {
    return { allow: false, outcome: "throttled", reason: "Global sign-up rate exceeded" };
  }
  if (v.ipLastDay >= SIGNUP_POLICY.perIpPerDay) {
    return { allow: false, outcome: "blocked", reason: "Daily sign-ups from this network exceeded" };
  }
  if (v.ipLastHour >= SIGNUP_POLICY.perIpPerHour) {
    return { allow: false, outcome: "throttled", reason: "Hourly sign-ups from this network exceeded" };
  }
  return { allow: true, watch: v.ipLastWeek + 1 >= SIGNUP_POLICY.watchThresholdPerWeek };
}

const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com",
  "guerrillamail.com",
  "10minutemail.com",
  "tempmail.com",
  "temp-mail.org",
  "yopmail.com",
  "trashmail.com",
  "sharklasers.com",
  "getnada.com",
  "dispostable.com",
  "maildrop.cc",
  "throwawaymail.com",
]);

export const EmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, "Email is too long.")
  .email("Enter a valid email address.")
  .refine((v) => !DISPOSABLE_DOMAINS.has(v.split("@")[1] ?? ""), "Disposable email addresses are not accepted.");

export function emailDomain(email: string): string {
  return (email.split("@")[1] ?? "").toLowerCase().slice(0, 120);
}
