# Feature parity: comparable apps and where we stand

Checked 2026-11-07 against each product's public pages, docs and changelogs (closed-source apps are studied from what they publish, not taken apart). ✓ = offers it, ◐ = partly, – = not found or not offered. "Main" is the spec version (Matt's spec); "Research" is the research layer (spec 002, proposed). Sources at the end. Keep this table current when either side changes.

## The apps

| App | Kind | What it is best at |
| --- | --- | --- |
| Ground News | News reader (closed) | One story across many outlets, with each outlet's bias rating and a weekly "blindspot" of lopsided coverage |
| Particle | News reader (closed) | AI summaries of a story, key quotes, entity pages, links to every outlet covering it |
| alphaXiv | Paper reader (closed) | Chat on a highlighted passage, AI blog posts of papers, audio, linked code |
| Hugging Face Daily Papers | Paper feed (open platform) | Community upvotes and discussion, authors claim papers, linked models and datasets, daily email |
| Papers with Code | Paper and results index | Shut down by Meta in July 2025; readers were pointed to Hugging Face Papers |
| scite | Citation evidence (closed) | Whether later papers support or contrast a claim, retraction notices, alerts, API and agent connector |
| Epoch AI benchmarking hub | Independent evaluations | Runs its own benchmark tests on models and publishes the data for download |
| Metaculus | Forecasting | Questions with written resolution criteria, scored by log and Brier scores; ambiguous and annulled outcomes |
| NewsGuard | Outlet ratings (closed) | Nine published criteria per outlet, with a score and a "nutrition label" explaining it |

## The matrix

| Feature | Ground | Particle | alphaXiv | HF Papers | scite | Epoch | Metaculus | NewsGuard | Main | Research |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| One story across many sources | ✓ | ✓ | – | – | – | – | – | – | ✓ grouping (REQ spec) | ✓ write-up joins the paper's story |
| Topic tags you can browse | – | ✓ | – | – | – | – | ✓ | – | ✓ explainable tags | ✓ topic dossiers |
| Upvotes | – | – | – | ✓ | – | – | – | – | ✓ | – |
| Saves and lists | – | – | – | – | ✓ collections | – | – | – | ✓ saves (lists: extended) | – |
| Discussion on an item | – | – | – | ✓ | – | – | ✓ | – | ◐ notes (extended) | – |
| Plain-language summary | – | ✓ AI | ✓ AI blog | – | – | – | – | – | ◐ feed summary | ✓ rule-based write-up, traced |
| Ask questions of a paper | – | ◐ | ✓ | – | ✓ assistant | – | – | – | – | – by design: no model on page loads |
| Outlet rating | ✓ bias | – | – | – | – | – | – | ✓ 9 criteria | – | ✓ grade A–E, published rules |
| Coverage gap ("blindspot") | ✓ | – | – | – | – | – | – | – | – | ✓ buzz versus evidence |
| Claim and evidence check | – | – | – | – | ✓ support/contrast | ✓ own evals | – | – | ◐ significance score | ✓ rigor, backed claims, guards |
| Independent re-test of a result | – | – | – | – | – | ✓ | – | – | – | ◐ Lab toy checks of a paper's idea |
| Retraction or withdrawal notice | – | – | – | – | ✓ | – | – | – | – | – next |
| Link to the paper's code | – | – | ✓ | ✓ | – | – | – | – | – | ✓ (added today) |
| Forecasts tracked and scored | – | – | – | – | – | – | ✓ | – | – | ◐ events, outcomes, hit rate; no probabilities yet |
| Who is talked about (entities) | – | ✓ pages | – | ◐ authors | – | – | – | – | ◐ org tags | ◐ mention counts only, by design |
| Email digest | ✓ | – | – | ✓ | ✓ alerts | – | – | – | – | – (RSS instead; email needs a paid sender) |
| RSS or open feed | – | – | – | – | – | – | – | – | – | ✓ `/research/feed.xml` |
| Download the data | – | – | – | – | ✓ API | ✓ | ◐ | – | – | ✓ `/research/data.json` (added today) |
| API or agent connector | – | – | – | ◐ | ✓ API, MCP | ✓ data | ✓ API | – | ◐ JSON API | ◐ JSON, agent kit MCP |
| Audio or video explainer | – | – | ✓ audio | – | – | – | – | – | – | ✓ recorded explainer video |
| Published scoring rules | ◐ | – | – | – | ◐ | ✓ | ✓ | ✓ | ✓ significance explained | ✓ `/research/criteria` |
| Bias controls on the judge itself | – | – | – | – | – | – | – | – | – | ✓ masks, prestige and wording tests, two-model panel |

## What we lead on

No app in the matrix judges the judging: published criteria that the code itself uses, anti-gaming guards measured on a benchmark that refuses regressions, bias tests on the model judges, and a label-free quality report on real data. That, plus the buzz-versus-evidence view, is the research layer's distinct contribution.

## Gaps worth closing (fits the free tier and the rules)

| Gap | Seen in | Cost | Plan |
| --- | --- | --- | --- |
| Withdrawal and retraction notice | scite | small | Flag papers whose abstract or arXiv page says withdrawn; send to a person (benchmark item first) |
| Probabilities on forecasts, Brier scores | Metaculus | small | Record a stated probability when a piece gives one; Brier only for those |
| Discussion on a write-up | HF Papers, Metaculus | medium | Reuse the extended version's notes; spec change needed for the main app |
| Support or contrast between papers | scite | medium | Extend "where papers agree" with a "where they disagree" list from reviewed papers on the same concept |
| Email digest | Ground, HF, scite | needs a sender | Leave to RSS readers until a free sender is approved |
| Ask a paper a question | alphaXiv, scite | conflicts with "no model on page loads" | Not planned for the web app; agents can do it offline |

## Sources

- Ground News Blindspot: https://about.ground.news/blindspot
- Particle on the web (TechCrunch, May 2025): https://techcrunch.com/2025/05/06/particle-brings-its-ai-powered-news-reader-to-the-web
- alphaXiv changelog: https://www.alphaxiv.org/changelog
- Hugging Face Daily Papers: https://huggingface.co/blog/daily-papers
- Papers with Code shutdown record: https://www.codesota.com/papers-with-code/shutdown
- scite features: https://scite.ai/features
- Epoch AI benchmarking dashboard: https://epoch.ai/blog/introducing-benchmarks-dashboard
- Metaculus scoring: https://www.metaculus.com/help/scores-faq/
- NewsGuard criteria: https://www.newsguardtech.com/newsguard-faq/
