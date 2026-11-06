---
name: add-sources
description: Add or fix where stories come from - default sources, the admin source catalog, sites without a feed, journals, people's blogs, paper searches - and check they parse. Use when asked to add, track or "harvest from" a lab, journal, researcher, newsletter, conference or paper feed.
---

# Add sources

**Never Twitter/X** (or Nitter or other mirrors). Use the person's blog or newsletter instead. Preflight checks both source files.

The shared spec asks for sources that regularly cover superintelligence (REQ-001: 8+ sources, 5+ kinds). Broad feeds are fine because the feed keeps only superintelligence stories (REQ-003), but prefer focused ones.

## Where a source goes
| File | Effect | Use for |
| --- | --- | --- |
| `lib/sources.json` | Seeded into new databases only | A small core everyone should have |
| `lib/source-catalog.json` → `sources` | Offered on Admin → Add sources; enabling one test-fetches it | Everything else |
| `lib/source-catalog.json` → `findFeed` | Shown with a "Find feed" button | Important sites with no known feed |

On the live site, admins add and fix sources on the Admin page. Editing these files doesn't change an existing database.

## Steps
1. **Find the real feed URL** (the site's `<link rel="alternate">`, `/feed`, `/rss.xml`, `/index.xml`). Never claim a URL works unless you fetched it; the sandbox usually can't, so say "unverified".
2. **Pick the kind**, which sets the evidence score: `journal` (peer-reviewed), `research-org`, `lab`, `papers`/`academic` (preprints), `policy`, `news`, `people`/`newsletter`/`forum` (commentary), `community`.
3. **Pick the format**: `rss`, `arxiv`, `jsonfeed`, `hf-daily`, `hn-algolia`, `semantic-scholar`. URL patterns and query tricks for each are in `references/formats.md`.
4. **Add the entry**: `{ "name", "kind", "format", "url", "home" }`.
5. **Check it parses** if you can reach it: `node -e "require('./lib/feeds').fetchSource({url:'<url>',format:'<fmt>'}).then(x=>console.log(x.length, x[0]))"`.
6. **Check tagging** on a few real titles: `node -e "console.log(require('./lib/tagger').tag('<title>','<summary>'))"`. If good stories come back untagged, use the tune-ontology skill.
7. `npm run preflight`, then the open-pull-request skill.

A new format (a new API) needs a parser in `lib/feeds.js` `FORMATS`, a synthetic fixture in `test/fixtures/`, and a browser or unit check.
