# Free-tier limits and tactics

Checked Nov 5, 2026 (see docs/DEPLOY.md for links). Recheck before relying on the numbers.

| Limit | Allowance | Tactic in this repo |
| --- | --- | --- |
| Neon storage | 1 GB per project | Prune: `fetch_runs` 2,000 rows, `admin_audit` 5,000, expired sessions; summaries capped at 1,500 chars, titles at 500. Admin → Overview shows the size. |
| Neon compute | 100 CU-hours/month, scales to zero after 5 idle minutes | Pool of 2 on Vercel, idle connections closed after 5 s (`PG_POOL`, `PG_IDLE_MS`). No polling pages, no keep-alive. |
| Neon egress | 5 GB/month | Pages fetch 40 stories at a time; aggregates are computed in SQL, not by shipping rows |
| Vercel cron (Hobby) | Each job at most daily | Four daily jobs at 00/06/12/18 UTC = a harvest every 6 h; add another daily job rather than a more frequent one |
| Vercel functions | 1M invocations, 4 active CPU-hours | One function; network waiting isn't active CPU; no background loops |
| Function duration | `maxDuration` 60 s here (Hobby allows up to 300 s) | Harvest budget 45 s; unreached sources go first next time |
| Bandwidth | 100 GB | `/js` and `/css` cached for an hour; static pages from the CDN |

New feature checklist: does it add rows forever (prune it)? Does it run on every page view (cache or aggregate)? Does it need a schedule (use a daily cron entry)? Does it call a paid API (don't, or make it optional and off by default)?
