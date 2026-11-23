import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { listHarvestRuns } from "@/lib/harvest-runs";
import {
  AI_UNIT_COST,
  readSpendSettings,
  SPEND_SETTING_DOCS,
  TIER_LABEL,
  TIER_LIMITS,
  type MeteredAction,
  type Tier,
} from "@/lib/limits";
import { getUsageSnapshot } from "@/lib/usage";

export const metadata: Metadata = {
  title: "Usage Limits",
  description: "Per-account quotas and the spend ceilings that keep AI cost bounded.",
};

const ACTION_LABEL: Record<MeteredAction, string> = {
  analyze: "Analyze a link",
  vote: "Vote",
  save: "Save",
  review_verdict: "Review vote",
  review_flag: "Flag a story",
  export: "Export",
  harvest_manual: "Manual harvest",
  ai_judge: "AI judging",
};

const TIERS: Tier[] = ["anonymous", "free", "reviewer"];
const timeFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "UTC",
});

function formatValue(value: boolean | number): string {
  if (typeof value === "boolean") return value ? "On" : "Off";
  return value.toLocaleString("en-US");
}

export default async function LimitsPage() {
  const user = await getCurrentUser();
  const settings = readSpendSettings();
  const [usage, runs] = await Promise.all([
    getUsageSnapshot(user ? `u:${user.id}` : "none"),
    listHarvestRuns(6),
  ]);

  const actions = (Object.keys(ACTION_LABEL) as MeteredAction[]).filter((a) =>
    TIERS.some((t) => TIER_LIMITS[t][a]),
  );
  const aiPct = settings.dailyAiUnitCap > 0 ? Math.min(100, Math.round((usage.aiUnitsToday / settings.dailyAiUnitCap) * 100)) : 100;

  return (
    <>
      <div className="feed-banner">
        <div>
          <p className="eyebrow-label">Abuse and spend protection</p>
          <h1 className="feed-heading">Usage limits</h1>
          <p className="feed-subtitle">
            Every action that writes data or costs money has a daily and per-minute limit. The same table below is the
            one the server enforces.
          </p>
        </div>
      </div>

      <section className="panel-grid" aria-label="Today">
        <div className="stat-card">
          <div className="stat-value">{user ? TIER_LABEL[user.tier] : TIER_LABEL.anonymous}</div>
          <div className="stat-label">Your tier</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">
            {usage.aiUnitsToday.toLocaleString("en-US")}
            <span className="stat-of"> / {settings.dailyAiUnitCap.toLocaleString("en-US")}</span>
          </div>
          <div className="stat-label">AI units used today, site-wide</div>
          <div className="bar-track" aria-hidden="true">
            <div className="bar-fill" data-pct-decile={Math.round(aiPct / 10)} />
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{settings.aiEnabled ? "On" : "Off"}</div>
          <div className="stat-label">AI judging</div>
        </div>
      </section>

      <section aria-labelledby="quota-heading">
        <h2 id="quota-heading" className="section-heading">Limits by tier</h2>
        <p className="section-lede">
          Shown as per day / per minute. A dash means the action needs a higher tier.
          {user ? " Your column shows what you have used today." : " Sign in to see your own usage."}
        </p>
        <div className="matrix-table-wrap">
          <table className="matrix-table">
            <thead>
              <tr>
                <th scope="col">Action</th>
                {TIERS.map((t) => (
                  <th key={t} scope="col" className="num">
                    {TIER_LABEL[t]}
                  </th>
                ))}
                {user ? (
                  <th scope="col" className="num">
                    Used today
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {actions.map((a) => (
                <tr key={a}>
                  <th scope="row">{ACTION_LABEL[a]}</th>
                  {TIERS.map((t) => {
                    const limit = TIER_LIMITS[t][a];
                    return (
                      <td key={t} className={user?.tier === t ? "num current-tier" : "num"}>
                        {limit ? `${limit.perDay} / ${limit.perMinute}` : "—"}
                      </td>
                    );
                  })}
                  {user ? <td className="num">{usage.perAction[a] ?? 0}</td> : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="spend-heading">
        <h2 id="spend-heading" className="section-heading">Spend settings</h2>
        <p className="section-lede">
          Operators set these as environment variables, so cost can be tightened without changing code. A Tier 1 model
          call costs {AI_UNIT_COST.tier1} unit; a Tier 2 call costs {AI_UNIT_COST.tier2}. When the daily ceiling is
          reached, stories fall back to the free rule-based score.
        </p>
        <div className="matrix-table-wrap">
          <table className="matrix-table">
            <thead>
              <tr>
                <th scope="col">Setting</th>
                <th scope="col">Variable</th>
                <th scope="col" className="num">
                  Current
                </th>
              </tr>
            </thead>
            <tbody>
              {SPEND_SETTING_DOCS.map((doc) => (
                <tr key={doc.env}>
                  <th scope="row">{doc.label}</th>
                  <td className="mono">{doc.env}</td>
                  <td className="num">{formatValue(settings[doc.key])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="runs-heading">
        <h2 id="runs-heading" className="section-heading">Recent harvests</h2>
        <p className="section-lede">Each fetch is logged with how many sources worked and how much it judged.</p>
        {runs.length === 0 ? (
          <div className="empty-state">
            <p>No harvests recorded yet.</p>
          </div>
        ) : (
          <div className="matrix-table-wrap">
            <table className="matrix-table">
              <thead>
                <tr>
                  <th scope="col">Started (UTC)</th>
                  <th scope="col">Trigger</th>
                  <th scope="col" className="num">Sources ok</th>
                  <th scope="col" className="num">Failed</th>
                  <th scope="col" className="num">New</th>
                  <th scope="col" className="num">Judged</th>
                  <th scope="col" className="num">To review</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.id}>
                    <td>{timeFormat.format(run.startedAt)}{run.finishedAt ? "" : " (running)"}</td>
                    <td>{run.trigger}</td>
                    <td className="num">{run.sourcesOk}</td>
                    <td className="num">{run.sourcesFailed}</td>
                    <td className="num">{run.created}</td>
                    <td className="num">{run.judged}</td>
                    <td className="num">{run.queuedForReview}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="form-note">
        Why these limits exist: <Link href="/compare#spend">see the build comparison</Link>.
      </p>
    </>
  );
}
