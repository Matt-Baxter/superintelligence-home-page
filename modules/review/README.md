# review

The review desk: paste a paper, article, press release, blog post or comment (or give an arXiv id) and it is judged by published rules, behind guards against gaming, and catalogued in the knowledge graph. Two separate axes: how big a step it reports (significance) and how far to believe it (credibility). Deterministic; any model calls happen in background runs (`scripts/watch.js`), never in a web request.

- **Judge** (`review.js`): evidence checks, claims, hype, guards, verdicts; the same `CRITERIA` table the pages print. Credibility rules are field-neutral (tested on 16 fields, `docs/TRANSFER.md`); significance and tags are AI-specific.
- **Sources** (`sources.js`): outlet grades A to E, forecasts as events, Brier-scored track records, buzz kept apart from evidence. **Dossiers** (`dossier.js`): one topic's evidence, buzz, contested claims and forecasts. **Panel** (`panel.js`): two models from different makers on masked text, with prestige and wording counterfactuals and an advisor that never scores.
- **Blind labels** (`agreement.js`, `/m/labels`): people say whether they'd rely on a piece before seeing the verdict; Cohen's kappa between people and between the judge and people.
- **Tables** (via `db.schema`): `review_docs`, `review_events`, `review_blind`; pruned to the newest 1,000 reviews.
- **Routes**: `/api/review/*` (signed in), `/api/admin/review/*` (admins), all described in `actions.js` for the action catalog (`/api/admin/meta`). **Pages**: `/m/review`, `/m/labels`, `/m/map`, `/m/dossier`. **Nav**: Review, Map, Label (admins).
- **Extension point it owns**: `review.judge`, the judge and criteria plus `sources` and `dossier`, for modules that build on reviews (research) without importing these files.
- **Points it uses, if present**: `lab.examples`, `learn.concepts` (optional, through `ctx.optional`); `knowledge` is required.
- **Checks**: unit `review`, `sources`, `panel`, `dossier`, `agreement`; bench suites `review.*` and `domains.*`; research feed test.
