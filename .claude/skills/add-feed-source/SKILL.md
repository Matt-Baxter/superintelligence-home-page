---
name: add-feed-source
description: Add or fix a default news source (RSS/Atom, arXiv API, or Hugging Face Daily Papers) in lib/sources.json, and check that it parses. Use when asked to add a lab blog, newsletter, research org or paper feed.
---

# Add a feed source

1. **Never Twitter/X** (or Nitter or other mirrors). Suggest the person's blog or newsletter instead.
2. **Find the real feed URL** on the site (look for `/feed`, `/rss.xml`, `/atom.xml`, or a `<link rel="alternate" type="application/rss+xml">`). Don't guess a URL and claim it works.
3. **Pick the kind**: one of `papers`, `lab`, `research-org`, `forum`, `newsletter`, `academic`, `community`, `news` or `policy`. Mixing kinds is the point of this homepage.
4. **Add an entry** to `lib/sources.json`:
   `{ "name": "…", "kind": "…", "format": "rss" | "arxiv" | "hf-daily", "url": "<feed URL>", "home": "<site URL>" }`
   This only seeds new databases. On a live site, the admin adds sources from the Sources page instead.
5. **Check it parses.** If you can fetch the feed, run:
   `node -e "require('./lib/feeds').fetchSource({url:'<url>',format:'rss'}).then(x=>console.log(x.length, x[0]))"`
   If the network blocks it, say so plainly rather than claiming success.
6. **Check tagging** on a couple of real titles with `node -e "console.log(require('./lib/tagger').tag('<title>','<summary>'))"`. If good stories come back untagged, propose ontology terms in `lib/ontology.json` (in a separate commit, as it changes tagging for everyone).
7. Open a PR with the open-pull-request skill.
