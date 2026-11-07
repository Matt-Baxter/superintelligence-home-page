# Research site: a second deployment that feeds the feed

**Status:** built and tested on `fix/sync-with-main`; proposed as REQ-032 in `specs/002-research-layer/spec.md`, so it needs both partners' approval. Nothing here changes the spec version. Deploying it, and adding its feed as a source on the spec site, are people's steps (agents don't deploy or change Vercel).

## What it is

The same codebase run as `SITE_PROFILE=research`. It publishes, at `/research`:

- a plain-language write-up of each reviewed paper or article that wasn't judged doubtful: what it claims, how far to believe it and why, the guards that fired, what the abstract doesn't show, and its trace (`doc:<hash>`);
- a page per topic dossier rated above "none yet" (the rating ladder stops at "some support");
- `/research/criteria`, the published judging rules, and `/research/outlets`, each outlet's grades and forecast track record (personal blogs pooled, never by writer);
- `/research/feed.xml`, an RSS 2.0 feed of the write-ups and topic pages.

Every page is tagged **Research preview**, sends `noindex, nofollow`, and has no nav entry. Comments and doubtful reviews never go out, nor does anything a person disagreed with.

## How it feeds the feed

The spec version adds `https://<research host>/research/feed.xml` as an ordinary RSS source (admin → Sources). Its own scope rule judges each item, and because each item keeps the paper's own title, a write-up about a paper already in the feed joins that paper's story as one more source instead of making a second story. The spec version needs no code change. `npm run test:research` proves this on synthetic data (15 checks, also in preflight).

## Hidden until you opt in

| `RESEARCH_PUBLIC` | Who sees `/research` |
| --- | --- |
| unset (default, and on the extended site) | signed-in admins only; everyone else gets 404 |
| `1` | everyone (still noindex and tagged as a preview) |

## Deploying it (people's steps)

1. In Vercel, create a second project from the same repo (or a Preview deployment of this branch).
2. Set `SITE_PROFILE=research`, `RESEARCH_PUBLIC=1`, `SITE_URL=https://<research host>` and its own `DATABASE_URL` (a separate Neon branch or database keeps the spec site's data apart; stays on the free tier).
3. Point a subdomain at it, for example `research.<your domain>`.
4. Run the daily watcher against it (`npm run watch`, or the existing scheduled task) so reviews accumulate.
5. On the spec site, add the research feed as a source, kind `research-org`.

Free-tier notes: the pages are rendered on request from at most 200 reviews and the top-level topics; no model calls, no polling, no new cron.
