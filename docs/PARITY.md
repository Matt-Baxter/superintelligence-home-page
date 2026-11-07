# Feature parity: this homepage against 35 AI-news, paper and feed-reading apps

Where this homepage stands against 35 AI-news, paper and feed-reading apps on 33 features, checked against our own code, with the gaps ranked and mapped to REQs.

Checked 2026-11. The survey covers public features only: each claim about another app comes from its public pages, documentation, published papers or independent reviews, linked in [market/apps.json](market/apps.json). Nothing was decompiled, nothing was read from behind a login, and every note is in our own words. No person's claims are recorded and no Twitter/X data was used. Our own column was checked against the combined code on branch `feature/si-combined` (2026-11-07); the gaps that need new requirements are proposed in [specs/004-parity](../specs/004-parity/spec.md) (**proposed, not approved**, extended version only).

## Contents

1. [Matrix](#matrix) (three tables by app group)
2. [Our column, verified](#our-column-verified) (with the file or route that proves each status, and what changed from the research's guess)
3. [Best-in-class patterns](#best-in-class-patterns) (one per dimension, in our words, with sources)
4. [Ranked gaps](#ranked-gaps) (re-ranked after verification, each mapped to a REQ)
5. [Limits of this survey](#limits-of-this-survey)

## Matrix

Key: ✓ has it · ◐ partial · ✗ confirmed absent (for us: missing) · blank = not found or not verified (absence not confirmed) · (disc.) discontinued. "Ours" is the verified column below; the other columns come straight from [market/apps.json](market/apps.json).

### News, communities and newsletters

Apps: **TM** [Techmeme](https://www.techmeme.com) · **HN** [Hacker News](https://news.ycombinator.com) · **LO** [Lobsters](https://lobste.rs) · **RML** [Reddit r/MachineLearning](https://www.reddit.com/r/MachineLearning/) · **GN** [Ground News](https://ground.news) · **PD** [Perplexity Discover](https://www.perplexity.ai/discover) · **LW** [LessWrong / AI Alignment Forum (ForumMagnum)](https://www.lesswrong.com) · **IAI** [Import AI (newsletter)](https://importai.substack.com) · **TB** [The Batch (DeepLearning.AI)](https://www.deeplearning.ai/the-batch/)

| Dimension | Ours | TM | HN | LO | RML | GN | PD | LW | IAI | TB |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| RSS/Atom ingestion | ✓ |  |  |  |  |  |  |  |  |  |
| arXiv / paper ingestion | ✓ |  |  |  |  |  |  |  |  |  |
| Custom sources | ✓ |  | ✓ | ✓ | ✓ |  |  |  |  |  |
| Sites without a feed | ◐ |  |  |  |  |  |  |  |  |  |
| Dedup / story grouping | ✓ | ✓ | ◐ |  |  | ✓ |  |  |  |  |
| Topic tagging | ✓ |  |  | ✓ | ✓ |  | ◐ |  |  | ✓ |
| Explainable ranking | ✓ | ◐ | ◐ | ✓ |  |  |  |  |  |  |
| Personalisation | ✗ |  |  |  |  |  | ✓ |  |  |  |
| Search | ◐ | ✓ |  |  |  |  |  |  |  | ✓ |
| Filters / mute | ◐ |  |  |  |  |  |  |  |  |  |
| Saves / reading lists | ✓ |  |  |  |  |  |  |  |  |  |
| Notes / highlights | ◐ |  |  |  |  |  |  |  |  |  |
| Votes | ✓ |  | ✓ | ✓ | ✓ |  |  | ✓ |  |  |
| Comments | ◐ |  | ✓ | ✓ | ✓ |  |  | ✓ | ◐ |  |
| Moderation / anti-gaming | ◐ | ✓ | ✓ | ✓ | ✓ |  |  | ✓ |  |  |
| Summaries | ◐ |  |  |  |  |  |  |  |  |  |
| Claim / evidence checking | ◐ |  |  |  |  |  |  |  |  |  |
| Citations / graph | ◐ |  |  |  |  |  |  |  |  |  |
| Alerts / digests / output feeds | ◐ | ✓ |  |  |  |  |  |  | ✓ | ✓ |
| Coverage comparison | ◐ |  |  |  |  | ✓ |  |  |  |  |
| Source-type / credibility labels | ◐ |  |  |  |  | ✓ |  |  |  |  |
| Export / API | ◐ |  |  |  |  |  |  |  |  |  |
| Minimal accounts / privacy | ✓ |  | ✓ |  |  |  |  |  |  |  |
| Mobile / PWA / offline | ◐ |  |  |  |  |  |  |  |  |  |
| Accessibility | ◐ |  |  |  |  |  |  |  |  |  |
| Open source / self-host | ◐ |  |  | ✓ |  |  |  | ✓ |  |  |
| Free tier | ✓ | ✓ | ✓ | ✓ | ✓ | ◐ |  | ✓ | ◐ |  |
| AI features | ◐ |  |  |  |  |  | ◐ |  |  |  |
| Reproducibility (code links) | ◐ |  |  |  |  |  |  |  |  |  |
| Forecasting / benchmark data | ◐ |  |  |  |  |  |  |  |  |  |
| Admin / source management | ✓ |  |  | ✓ |  |  |  |  |  |  |
| Analytics / trends | ✓ | ✓ |  |  |  |  |  |  |  |  |
| Public audit trail | ◐ | ◐ | ◐ |  |  |  |  |  |  |  |

### Paper and research tools

Apps: **HF** [Hugging Face Daily Papers / Trending Papers](https://huggingface.co/papers) · **aX** [alphaXiv](https://www.alphaxiv.org) · **PwC** [Papers with Code](https://paperswithcode.com) (disc.) · **ASL** [arXiv Sanity Lite](https://arxiv-sanity-lite.com) · **SI** [Scholar Inbox](https://www.scholar-inbox.com) · **S2** [Semantic Scholar (Research Feeds & Alerts)](https://www.semanticscholar.org) · **GS** [Google Scholar alerts](https://scholar.google.com) · **RR** [ResearchRabbit](https://www.researchrabbit.ai) · **CP** [Connected Papers](https://www.connectedpapers.com) · **LM** [Litmaps](https://www.litmaps.com) · **EL** [Elicit](https://elicit.com) · **CO** [Consensus](https://consensus.app) · **SC** [scite](https://scite.ai) · **EM** [Emergent Mind](https://www.emergentmind.com)

| Dimension | Ours | HF | aX | PwC | ASL | SI | S2 | GS | RR | CP | LM | EL | CO | SC | EM |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| RSS/Atom ingestion | ✓ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| arXiv / paper ingestion | ✓ | ✓ | ✓ |  | ✓ | ✓ | ✓ |  |  |  |  |  |  |  | ✓ |
| Custom sources | ✓ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| Sites without a feed | ◐ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| Dedup / story grouping | ✓ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| Topic tagging | ✓ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| Explainable ranking | ✓ | ◐ |  |  | ◐ | ◐ |  |  |  | ◐ |  |  |  |  | ◐ |
| Personalisation | ✗ |  |  |  | ✓ | ✓ | ✓ |  |  |  |  |  |  |  |  |
| Search | ◐ |  |  |  | ✓ | ✓ |  |  |  |  |  | ✓ |  |  |  |
| Filters / mute | ◐ |  |  |  |  |  |  |  | ◐ |  |  |  | ✓ |  |  |
| Saves / reading lists | ✓ |  |  |  | ✓ | ✓ | ✓ |  | ✓ |  |  |  |  |  |  |
| Notes / highlights | ◐ |  |  |  |  |  |  |  |  |  | ◐ |  |  |  |  |
| Votes | ✓ | ✓ | ✓ |  |  | ✓ |  |  |  |  |  |  |  |  |  |
| Comments | ◐ | ✓ | ✓ |  |  |  |  |  |  |  |  |  |  |  |  |
| Moderation / anti-gaming | ◐ | ◐ | ✓ |  |  |  |  |  |  |  |  |  |  |  |  |
| Summaries | ◐ |  | ✓ |  |  |  | ✓ |  |  |  |  | ✓ | ✓ |  |  |
| Claim / evidence checking | ◐ |  |  |  |  |  |  |  |  |  |  | ✓ | ✓ | ✓ |  |
| Citations / graph | ◐ | ◐ |  |  |  | ✓ | ✓ |  | ✓ | ✓ | ✓ |  |  | ✓ |  |
| Alerts / digests / output feeds | ◐ | ✓ |  |  | ✓ | ✓ | ✓ | ✓ |  |  | ✓ | ◐ |  | ✓ |  |
| Coverage comparison | ◐ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| Source-type / credibility labels | ◐ |  |  |  |  |  |  |  |  |  |  |  | ✓ | ✓ |  |
| Export / API | ◐ |  |  | ✓ |  | ◐ | ✓ | ✗ | ◐ |  | ✓ | ◐ |  | ✓ |  |
| Minimal accounts / privacy | ✓ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| Mobile / PWA / offline | ◐ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| Accessibility | ◐ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| Open source / self-host | ◐ |  |  |  | ✓ |  |  |  |  |  |  |  |  |  |  |
| Free tier | ✓ | ✓ |  |  | ✓ | ✓ | ✓ | ✓ | ◐ | ◐ | ◐ | ◐ |  | ◐ |  |
| AI features | ◐ |  | ✓ |  |  |  | ✓ |  |  |  |  | ✓ | ✓ | ✓ | ✓ |
| Reproducibility (code links) | ◐ | ✓ | ✓ | ✓ |  |  |  |  |  |  |  |  |  |  |  |
| Forecasting / benchmark data | ◐ |  |  | ✓ |  |  |  |  |  |  |  |  |  |  |  |
| Admin / source management | ✓ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| Analytics / trends | ✓ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| Public audit trail | ◐ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |

### Feed readers, read-later, trackers and data

Apps: **FE** [Feedly (incl. Feedly AI / Leo)](https://feedly.com) · **IN** [Inoreader](https://www.inoreader.com) · **NB** [NewsBlur](https://newsblur.com) · **MF** [Miniflux](https://miniflux.app) · **FR** [FreshRSS](https://freshrss.org) · **TT** [Tiny Tiny RSS](https://github.com/tt-rss/tt-rss) · **OM** [Omnivore](https://omnivore.app) (disc.) · **RW** [Readwise Reader](https://readwise.io/read) · **MC** [Metaculus](https://www.metaculus.com) · **EP** [Epoch AI Data Hub](https://epoch.ai/data) · **AIID** [AI Incident Database](https://incidentdatabase.ai) · **SoA** [State of AI Report](https://www.stateof.ai)

| Dimension | Ours | FE | IN | NB | MF | FR | TT | OM | RW | MC | EP | AIID | SoA |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| RSS/Atom ingestion | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |  |  |  |  |
| arXiv / paper ingestion | ✓ |  |  |  |  |  |  |  |  |  |  |  |  |
| Custom sources | ✓ |  |  |  |  |  |  |  |  |  |  | ✓ |  |
| Sites without a feed | ◐ |  | ✓ |  | ◐ | ✓ |  |  |  |  |  |  |  |
| Dedup / story grouping | ✓ | ✓ | ◐ | ✓ |  |  |  |  |  |  |  | ✓ |  |
| Topic tagging | ✓ | ✓ |  |  |  |  |  |  |  |  |  | ✓ |  |
| Explainable ranking | ✓ |  |  | ✓ |  |  |  |  |  |  |  |  |  |
| Personalisation | ✗ |  |  | ✓ |  |  |  |  |  |  |  |  |  |
| Search | ◐ |  | ✓ | ✓ | ✓ |  |  | ✓ |  |  |  |  |  |
| Filters / mute | ◐ | ✓ | ✓ |  | ✓ |  |  |  |  |  |  |  |  |
| Saves / reading lists | ✓ |  |  | ✓ |  | ✓ |  |  | ✓ |  |  |  |  |
| Notes / highlights | ◐ |  | ✓ |  |  |  |  | ✓ | ✓ |  |  |  |  |
| Votes | ✓ |  |  |  |  |  |  |  |  |  |  |  |  |
| Comments | ◐ |  |  | ✓ |  |  |  |  | ◐ | ✓ |  |  |  |
| Moderation / anti-gaming | ◐ |  |  |  |  |  |  |  |  |  |  |  |  |
| Summaries | ◐ |  |  |  |  |  |  |  |  |  |  |  |  |
| Claim / evidence checking | ◐ |  |  |  |  |  |  |  |  |  |  |  |  |
| Citations / graph | ◐ |  |  |  |  |  |  |  |  |  |  |  |  |
| Alerts / digests / output feeds | ◐ | ✓ | ✓ |  |  |  |  |  |  |  |  | ◐ | ◐ |
| Coverage comparison | ◐ |  |  |  |  |  |  |  |  |  |  |  |  |
| Source-type / credibility labels | ◐ |  |  |  |  |  |  |  |  |  |  |  |  |
| Export / API | ◐ |  | ✓ |  | ✓ | ✓ |  | ✓ |  |  | ✓ | ✓ |  |
| Minimal accounts / privacy | ✓ |  |  |  | ✓ |  |  |  |  |  |  |  |  |
| Mobile / PWA / offline | ◐ |  | ✓ | ✓ | ✓ | ◐ |  |  |  |  |  |  |  |
| Accessibility | ◐ |  | ◐ |  | ◐ |  |  | ✓ | ✓ |  |  |  |  |
| Open source / self-host | ◐ |  |  | ✓ | ✓ | ✓ | ✓ | ✓ |  | ✓ |  | ✓ |  |
| Free tier | ✓ | ◐ | ✓ | ◐ |  | ✓ |  |  |  | ✓ | ✓ |  |  |
| AI features | ◐ | ✓ | ✓ | ✓ |  |  |  |  | ✓ |  |  |  |  |
| Reproducibility (code links) | ◐ |  |  |  |  |  |  |  |  |  |  |  |  |
| Forecasting / benchmark data | ◐ |  |  |  |  |  |  |  |  | ✓ | ✓ |  | ✓ |
| Admin / source management | ✓ |  |  |  |  |  |  |  |  |  |  | ✓ |  |
| Analytics / trends | ✓ | ✓ |  |  |  |  |  |  |  |  | ✓ | ✓ |  |
| Public audit trail | ◐ |  |  |  |  |  |  |  |  | ✓ |  |  | ✓ |
## Our column, verified

Each status was checked in the code (routes in `server.js` and `modules/*/routes.js`, pages in `public/` and `modules/*/pages`, `lib/`, [INTERFACES.md](INTERFACES.md)). "(extended)" means the feature runs only with `SITE_PROFILE=extended`.

| Dimension | Research's guess | Verified | Evidence |
|---|---|---|---|
| RSS/Atom ingestion | have | **have** | RSS/Atom and JSON Feed parsers (`FORMATS` in [lib/feeds.js](../lib/feeds.js)); scheduled harvest in [lib/harvest.js](../lib/harvest.js) |
| arXiv / paper ingestion | have | **have** | `arxiv`, `hf-daily` and `semantic-scholar` formats in [lib/feeds.js](../lib/feeds.js); daily paper watch [scripts/watch.js](../scripts/watch.js) (extended) |
| Custom sources | check | **have** (changed) | admin adds sources, enables catalog entries and imports OPML (POST /api/admin/sources, /api/admin/catalog/enable, /api/admin/opml in [modules/admin/routes.js](../modules/admin/routes.js)); readers suggest feeds into a pending queue (POST /api/sources/suggest, [server.js](../server.js), extended) |
| Sites without a feed | check | partial (changed) | POST /api/admin/sources/discover finds feed links on a page (`discoverFeeds` in [lib/feeds.js](../lib/feeds.js)) and two search APIs act as feeds (`hn-algolia`, `semantic-scholar`); no HTML-to-feed scraping rules |
| Dedup / story grouping | have | **have** | `storyKeys` (arXiv id, normalised URL, normalised title) in [lib/feeds.js](../lib/feeds.js); `addItem` in [lib/harvest.js](../lib/harvest.js); there is no read state to carry across a group |
| Topic tagging | have | **have** | [lib/tagger.js](../lib/tagger.js) against [lib/ontology.json](../lib/ontology.json), matched words shown (REQ-005) |
| Explainable ranking | have | **have** | 0-100 significance with a reason per point ([lib/analysis.js](../lib/analysis.js)); feed rank formula in `storyRows` ([server.js](../server.js)) |
| Personalisation | missing | **missing** | sorts are top, new, votes and signal only (GET /api/stories, [server.js](../server.js)); GET /api/knowledge/similar ranks by a typed query, not by the reader's history |
| Search | check | partial (changed) | `q` on GET /api/stories is a substring LIKE over title and summary ([server.js](../server.js)), wired to the search box in [public/index.html](../public/index.html); embedding similarity at GET /api/knowledge/similar (extended); no full-text index, tags or matched words not searched |
| Filters / mute | partial | partial | topic, source kind, organisation, `tag=` (topic/org/benchmark/person), days, minimum significance and saved-only on GET /api/stories ([server.js](../server.js)); no mute or negative filters |
| Saves / reading lists | have | **have** | POST /api/stories/:id/save ([server.js](../server.js)); reading lists with follow, /api/lists and [public/lists.html](../public/lists.html) (extended) |
| Notes / highlights | partial | partial | private or public notes per story, POST /api/stories/:id/notes ([server.js](../server.js), extended); no highlights |
| Votes | have | **have** | one toggle vote per user per story, POST /api/stories/:id/vote ([server.js](../server.js)); single axis |
| Comments | check | partial (changed) | public notes are shown to every reader on the story page and counted on cards ([server.js](../server.js), [public/story.html](../public/story.html), extended); no replies or threads |
| Moderation / anti-gaming | partial | partial | admin hides stories and disables users (PUT /api/admin/stories/:id, /api/admin/users/:id), rate limits on sign-up, login, submit and suggest (`limit` in [server.js](../server.js)), suggestions queued as pending, Review desk guards ([modules/review](../modules/review)); votes have no rate limit or weighting |
| Summaries | partial | partial | feed summary stored (capped, REQ-007); dossiers and explainers ([modules/review/dossier.js](../modules/review/dossier.js), [modules/learn](../modules/learn), extended); no generated per-item summary |
| Claim / evidence checking | partial | partial | Review desk rigor, hype and credibility judges and bands ([modules/review/review.js](../modules/review/review.js), bands.js, extended) |
| Citations / graph | partial | partial | concept graph and knowledge graph (GET /api/knowledge/graph, /m/map, extended); `semantic-scholar` is a search feed only; no citation graph |
| Alerts / digests / output feeds | partial | partial | weekly brief in the app (GET /api/brief, [public/brief.html](../public/brief.html), extended); RSS of published Learn posts only (GET /api/learn/feed.xml); no story feeds out, no email, no 'since last visit' |
| Coverage comparison | partial | partial | story page 'covered by' table lists each source's name, kind and link ([public/story.html](../public/story.html)); independent-source count lifts rank ([server.js](../server.js)); `story_links.seen_at` is stored but not shown; no single-source list |
| Source-type / credibility labels | missing | partial (changed) | every source has a kind, shown on cards (`KIND` in [public/js/api.js](../public/js/api.js)), and the kind sets the evidence level that scores points (`EVIDENCE` in [lib/analysis.js](../lib/analysis.js): peer-reviewed, independent evaluation, lab, preprint, policy, news, commentary, community); no per-source primary/secondary or vendor/independent label |
| Export / API | check | partial (changed) | admin OPML export and import (GET/POST /api/admin/opml); JSON-LD export of the knowledge layer (GET /api/knowledge/export.jsonld, signed in); the JSON API needs sign-in; no export of a reader's own saves, lists and notes |
| Minimal accounts / privacy | have | **have** | username and password only, scrypt hashes, 30-day session cookie ([server.js](../server.js), REQ-009..012); tracking parameters stripped from links (`normUrl` in [lib/feeds.js](../lib/feeds.js)) |
| Mobile / PWA / offline | partial | partial | phone layout with no sideways scroll ([public/css/app.css](../public/css/app.css), REQ-018); no web app manifest or service worker |
| Accessibility | check | partial (changed) | labelled search, tabs with roles and `aria-selected`, alerts with `role=alert` ([public/index.html](../public/index.html), [modules/admin/pages/admin.html](../modules/admin/pages/admin.html)); no keyboard shortcuts, no audit recorded |
| Open source / self-host | check | partial (changed) | public GitHub repo; [package.json](../package.json) says ISC but there is no LICENSE file |
| Free tier | have | **have** | Vercel Hobby and Neon Free, daily cron ([vercel.json](../vercel.json), [docs/DEPLOY.md](../docs/DEPLOY.md)) |
| AI features | partial | partial | Learn studio jobs run by a local worker ([scripts/learn-worker.js](../scripts/learn-worker.js)), judges with no model calls; no paid calls by default |
| Reproducibility (code links) | partial | partial | Lab paper-to-code toys ([modules/lab/papers.js](../modules/lab/papers.js), extended); the `hf-daily` parser keeps title, summary and date only, so broad artifact extraction remains incomplete; research write-ups preserve the first repository URL |
| Forecasting / benchmark data | partial | partial | benchmark mentions with values in `story_entities`; capability tracker with highest reported score (GET /api/capabilities, extended); forecast events and stated-probability Brier scores in the research layer |
| Admin / source management | check | **have** (changed) | /m/admin: sources, catalog, discovery, test fetch, harvest runs, users, story moderation, ontology, re-tag, audit log ([modules/admin](../modules/admin)) |
| Analytics / trends | check | **have** (changed) | capability tracker: activity per area this window against the last (GET /api/capabilities, /m/capabilities, extended); admin overview counts (GET /api/admin/overview); brief compares topics with the week before |
| Public audit trail | partial | partial | admin audit log of who changed what ([lib/audit.js](../lib/audit.js), GET /api/admin/audit), admin-only; score reasons on every story; no public log of rule or ontology changes |

**What verification changed.** Of the 33 dimensions the research marked 10 as "check" and judged 23 from the project description. Against the code: 12 are **have**, 20 partial and 1 **missing** (personalisation). Ten statuses changed:

- **Up to have:** custom sources (admin add, catalog, OPML import and a reader suggestion queue all exist), admin and source management (the admin module covers sources, runs, users, moderation, ontology and an audit log) and analytics (the capability tracker compares each area with the previous window).
- **Settled as partial:** search (a substring match on title and summary already exists, but no full-text index), sites without a feed (feed discovery, no scraping rules), comments (public notes, no threads), export (admin OPML and a JSON-LD export, nothing for a reader's own data), accessibility (labels and roles, no audit) and open source (the repo is public and `package.json` says ISC, but there is no LICENSE file).
- **Up from missing to partial:** source credibility. Every source has a kind, shown on cards, and the kind already sets the evidence level that earns significance points; what's missing is a per-source label (primary or secondary, vendor or independent).

Two smaller findings: there is no per-user read state at all (so "mark a whole group read" doesn't apply yet), and votes have no rate limit, unlike sign-up, login, submit and suggest.

## Best-in-class patterns

One pattern per dimension worth borrowing, described in our own words. Sources are the apps' public pages or independent write-ups; see [market/apps.json](market/apps.json) for every feature's source.

| Dimension | Pattern worth borrowing | Source |
|---|---|---|
| RSS/Atom ingestion | Read Atom, RSS and JSON Feed alike; accept push (WebSub) so new items arrive without polling. | [Miniflux](https://codegraph.jelmer.uk/miniflux/2.3.2-1/README.md), [FreshRSS](https://github.com/FreshRSS/FreshRSS) |
| arXiv / paper ingestion | Take several preprint servers and proceedings, then match them to one paper graph so authors and citations line up. | [Scholar Inbox paper](https://arxiv.org/html/2504.08385v2) |
| Custom sources | Outside suggestions go to an editor queue and never go live unreviewed (we already do this). | [AIID about](https://incidentdatabase.ai/about/) |
| Sites without a feed | Turn a page into a feed with XPath or JSON-path rules, set up in a form. | [FreshRSS](https://github.com/FreshRSS/FreshRSS), [Inoreader web feeds](https://www.inoreader.com/blog/2020/04/convert-almost-any-webpage-into-rss-feed-with-inoreaders-web-feeds.html) |
| Dedup / grouping | Compare text across sources inside a time window, and mark every copy read once one is read. | [Feedly dedup](https://docs.feedly.com/article/218-how-does-deduplication-work), [Ground News](https://en.wikipedia.org/wiki/Ground_News) |
| Topic tagging | Let a tag change ordering as well as filtering; reuse outside taxonomies where they exist. | [Lobsters ranking write-up](https://blog.nilenso.com/blog/2026/01/20/lobsters-front-page/), [AIID taxonomy](https://incidentdatabase.ai/blog/the-first-taxonomy-of-ai-incidents) |
| Explainable ranking | Publish the formula (tag modifier, log of engagement, age window, capped comment votes) and show which rule coloured each item. | [Lobsters ranking write-up](https://blog.nilenso.com/blog/2026/01/20/lobsters-front-page/), [NewsBlur](https://newsblur.com/compare/inoreader) |
| Personalisation | A small per-user linear model over TF-IDF or embeddings, retrained after each thumbs up or down, asking about borderline items; cheap and needs no paid API. | [Scholar Inbox paper](https://arxiv.org/html/2504.08385v2), [arXiv Sanity](https://arxiv-sanity.duckdns.org/about) |
| Search | Database full-text search, plus "similar items". | [Miniflux](https://codegraph.jelmer.uk/miniflux/2.3.2-1/README.md), [Scholar Inbox paper](https://arxiv.org/html/2504.08385v2) |
| Filters / mute | Mute by word or rule; include and exclude patterns; filter research by study design and preprint status. | [Feedly mute filters](https://docs.feedly.com/category/706-mute-filters), [Miniflux](https://codegraph.jelmer.uk/miniflux/2.3.2-1/README.md), [Consensus review](https://aarontay.substack.com/p/a-2025-deep-dive-of-consensus-promises) |
| Saves / lists | Saved views defined by a query; unlimited colour-coded collections on the free plan. | [Readwise Reader docs](https://docs.readwise.io/reader/docs), [ResearchRabbit review](https://aarontay.substack.com/p/researchrabbits-2025-revamp-iterative) |
| Notes / highlights | Highlight a passage, note it and keep it in a highlights library; anchor comments to a section. | [Readwise Reader docs](https://docs.readwise.io/reader/docs), [alphaXiv](https://alphaxiv.org/blog/one-year) |
| Votes | Separate "this is important" from "I agree", and weight votes by the voter's standing. | [ForumMagnum](https://www.lesswrong.com/posts/dYwQCFkR6cCbP9Xqk/how-forummagnum-builds-communities-of-inquiry) |
| Comments | Comments anchored to the part of the paper they discuss. | [alphaXiv](https://alphaxiv.org/blog/one-year) |
| Moderation | Thresholds before a user can flag, software that drops suspect votes, down-weighting bursts from small groups, and hiding (not deleting) heavily downvoted comments. | [HN FAQ](https://news.ycombinator.com/newsfaq.html), [Techmeme](https://en.wikipedia.org/wiki/Techmeme), [alphaXiv](https://alphaxiv.org/blog/one-year) |
| Summaries | Fixed-field study snapshots (population, method, sample size, outcome); one-sentence TLDRs. | [Consensus review](https://aarontay.substack.com/p/a-2025-deep-dive-of-consensus-promises), [Semantic Scholar FAQ](https://webflow.semanticscholar.org/faq) |
| Claim / evidence | Sort each citing sentence into supporting, contrasting or mentioning; show the split of evidence across papers. | [scite](https://scite.ai/features), [Consensus review](https://aarontay.substack.com/p/a-2025-deep-dive-of-consensus-promises) |
| Citations / graph | Similarity from co-citation and bibliographic coupling, with "prior" and "derivative" views; maps grown from seed papers. | [Connected Papers guide](https://libguides.lmu.edu/AIresearchtools/CP), [Litmaps guide](https://www.casrai.org/guides/litmaps) |
| Alerts / digests | Choose digest days, get a catch-up after an absence, subscribe to output feeds. | [Scholar Inbox paper](https://arxiv.org/html/2504.08385v2), [Litmaps guide](https://www.casrai.org/guides/litmaps), [Inoreader](https://inoreader.com/pricing) |
| Coverage comparison | Show which kinds of outlet covered a story and list stories only one side covered. | [Ground News](https://en.wikipedia.org/wiki/Ground_News) |
| Source labels | Combine outside ratings of sources; flag retractions; tag study type. | [Ground News](https://en.wikipedia.org/wiki/Ground_News), [scite](https://scite.ai/features) |
| Export / API | REST API, OPML import and export, webhooks; open data as CSV with a licence and citation block. | [Miniflux](https://codegraph.jelmer.uk/miniflux/2.3.2-1/README.md), [Epoch data](https://epoch.ai/benchmarks/use-this-data) |
| Minimal accounts | Username and password only; strip trackers, proxy media, strict CSP. | [HN FAQ](https://news.ycombinator.com/newsfaq.html), [Miniflux](https://codegraph.jelmer.uk/miniflux/2.3.2-1/README.md) |
| Mobile / offline | Add to home screen, no app store; offline reading. | [Miniflux](https://codegraph.jelmer.uk/miniflux/2.3.2-1/README.md), [Inoreader](https://inoreader.com/pricing) |
| Accessibility | Text-to-speech and adjustable text; full keyboard navigation. | [Readwise Reader docs](https://docs.readwise.io/reader/docs), [Miniflux](https://codegraph.jelmer.uk/miniflux/2.3.2-1/README.md) |
| Open source | A small server-rendered app on SQLite under a permissive licence, close to our shape. | [Lobsters](https://github.com/lobsters/lobsters) |
| Free tier | A free API; open data under CC BY. | [Semantic Scholar FAQ](https://webflow.semanticscholar.org/faq), [Epoch data](https://epoch.ai/benchmarks/use-this-data) |
| AI features | Ask about a highlighted passage; users bring their own model key so the operator pays nothing. | [alphaXiv changelog](https://www.alphaxiv.org/changelog), [Inoreader](https://inoreader.com/pricing) |
| Reproducibility | Paper pages link code, models, datasets and demos. | [Hugging Face Daily Papers](https://huggingface.co/blog/daily-papers) |
| Forecasting / metrics | Benchmark time series as open data; checkable predictions (event, threshold, deadline) graded later. | [Epoch data](https://epoch.ai/benchmarks/use-this-data), [State of AI predictions](https://www.stateof.ai/predictions/how-accurate-is-the-state-of-ai-report) |
| Admin | A submission queue with an editor's guide; a moderator dashboard with tag admin. | [AIID about](https://incidentdatabase.ai/about/), [Lobsters](https://github.com/lobsters/lobsters) |
| Analytics / trends | Emerging-trend dashboards and source leaderboards. | [Feedly market intelligence](https://docs.feedly.com/category/728-market-intelligence), [Techmeme leaderboards](https://news.techmeme.com/150520/author-leaderboards) |
| Public audit trail | Never edit a prediction's original wording; grade each one hit, partial or miss in public. | [State of AI predictions](https://www.stateof.ai/predictions/how-accurate-is-the-state-of-ai-report) |

## Ranked gaps

Re-ranked after verification by value to a reader against effort, inside the constraints: free tiers (no polling, cron at most daily, no paid calls by default), link out with no full text stored (REQ-007), no personal data beyond a username and password (REQ-012), no Twitter/X (REQ-006) and no claims attributed to people. Every new REQ is an **extended-version addition** in [specs/004-parity](../specs/004-parity/spec.md) (proposed, not approved); none changes the shared spec's REQ-001..REQ-020.

| # | Gap | Today (verified) | Build idea | Effort | REQ |
|---|---|---|---|---|---|
| 1 | Personalised feed with explained picks | missing | Opt-in "For you" sort: a per-reader logistic model over TF-IDF of stored titles and summaries, trained from that reader's votes and saves, each pick showing the words that put it there. No paid API. | M | new: **REQ-041** (builds on REQ-013..016) |
| 2 | Full-text search | substring LIKE on title and summary | FTS5 on SQLite and a `tsvector` index on Postgres behind one helper; search titles, summaries, topics and matched words; LIKE stays as the fallback. | S | new: **REQ-042** (extends REQ-017 in the extended version) |
| 3 | Mute filters | none | Mute a word, tag or source; applied in the feed query; capped list kept with the account like saves. | S | new: **REQ-046** (extends REQ-017 in the extended version) |
| 4 | Atom feeds out and "since last visit" | weekly brief in the app; Learn posts RSS only | Atom feeds per topic and for the brief, cached at the edge; a "new since your last visit" marker kept in the browser, not on the server. No email. | S | new: **REQ-045** |
| 5 | Coverage panel per story group | "covered by" table (name, kind, link) | Add when each source first saw the story (`story_links.seen_at` is already stored), a by-kind summary, and a weekly list of single-source stories. | S | new: **REQ-043** (extends REQ-004 in the extended version) |
| 6 | Code and artifact links on papers | none (the HF parser drops them) | Keep code, model and dataset links found in the abstract or the paper page; "code available" badge; feeds the Lab. | S | new: **REQ-047** |
| 7 | Source-type labels | kind only, which sets the evidence level | A static label per source in the catalog (primary or secondary; peer-reviewed, preprint or neither; vendor or independent), shown on cards. Using it in the score is a separate, rules-tagged step. Labels describe sources, never people. | S | new: **REQ-044** |
| 8 | Public change log for rules and moderation | admin-only audit log | A public page listing rule and ontology versions with what changed, and moderation actions without admin names; append-only, pruned. | S | new: **REQ-051** |
| 9 | Data export and OPML | admin OPML only | A reader exports their own saves, lists and notes (JSON, CSV); the active source list as public OPML. | S | new: **REQ-049** |
| 10 | Vote hygiene and a second axis | one vote per story, no vote rate limit | Daily vote cap and lower weight for brand-new accounts in rank (rules); an optional separate "agree" reaction that never feeds rank. | M | new: **REQ-052** (REQ-013's one vote per story stays as it is) |
| 11 | Installable, offline reading list | phone layout only | Manifest and service worker caching the app shell and the saved list's cards (metadata and link only). | S | new: **REQ-050** (extends REQ-018 in the extended version; REQ-007 holds) |
| 12 | Citation neighbourhood | concept and knowledge graphs only | Prior and derivative papers for a paper or dossier from the free Semantic Scholar Graph API, fetched on demand, cached and pruned, ids, titles and links only. | M | new: **REQ-048** |
| 13 | Structured study snapshot | Review desk judges | Fixed fields for papers (task, benchmark, claimed gain, compute disclosed, code yes or no) filled by rules from the abstract. | M | existing REQ-027 (Review desk, spec 002); no new REQ |
| 14 | Highlights on our own summaries | notes only | Highlight a span of the stored summary (never publisher text) and attach a note. | M | would need a new REQ; not proposed in 004 |
| 15 | "Claims to watch" scorecard | none | Checkable claims about systems or benchmarks (never people), resolved from open benchmark data. | M | would need a new REQ; not proposed in 004 (needs both partners' view on scope first) |

Just outside: an accessibility pass with keyboard navigation and a recorded audit (S; extends REQ-018), and page-to-feed rules for sites without RSS (M; REQ-001 and REQ-008, through the add-sources skill).

What moved in the ranking: search, coverage, source labels, the change log and export all dropped from M to S or rose in the list because part of each already exists; personalisation stays first because it is the one confirmed absence; the study snapshot moved down because the Review desk (REQ-027) already does most of the judging.

## Limits of this survey

- Some pages could not be fetched (the arXiv Sanity Lite README, the Lobsters about page), so a few licences come from the repos' own statements and are marked unverified in the data.
- Some feature claims rest on vendors' own comparison pages, on encyclopedia entries or on independent reviews and library guides rather than on vendor documentation; pricing and free-plan limits change often.
- Perplexity Discover's features are from older coverage; Papers with Code and Omnivore are discontinued and kept for their patterns.
- Blank cells mean "not found", not "absent". Only one feature in the whole set is a confirmed absence.
- No account was created on, and nothing was logged into, any app.

## Combined research layer

The main matrix above retains the 33 surveyed dimensions. The combined extended build additionally preserves these research capabilities; these are code-backed implementation claims, not a new survey of competitors.

| Capability | Combined implementation | Check |
| --- | --- | --- |
| Withdrawn/retracted notices | Published withdrawn verdict, capped at 10, human review; preserved through the panel | review and panel units |
| Forecast probabilities and Brier | Event outcomes; explicit probabilities only; scores from three resolved forecasts | sources units, research-feed integration |
| Paper code links | First repository link on write-up and feed; broader artifact extraction remains proposed | research-feed integration |
| Open research data | Gated `/research/data.json`; no excerpts or writer names | research-feed integration |
| Where papers disagree | Dossier lists concepts explained by papers judged far apart | dossier units |
| Research badges in the main feed | Extended-only badge linking to the write-up; spec version unchanged | rigor-badge integration |
| Research management | `/m/control` for due forecasts, flagged reviews, quality and decisions; `/m/project#/specs` for proposals and tasks | research-feed integration and browser suite |

The model panel and advisor are tested with stand-ins. Live model agreement is unverified. The market survey is a historical snapshot; competitor features and free tiers have not been rechecked during this integration.
