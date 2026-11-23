# Scoring: factors and weights

The score is the sum of these lines, capped at 100.

| Factor | Points | Rule |
| --- | --- | --- |
| Evidence | 2–15 | Strongest linked source: journal 15, research-org 13, lab 12, preprint 9 (15 if a venue such as NeurIPS or Nature is named), policy 8, news 7, people/newsletter/forum 6, community 3, reader-submitted 2 |
| Coverage | 0–20 | 7 per extra independent source |
| Kind of update | 3–10 | First match: safety finding 10, release 10 (title only), new result 9, evaluation 7, policy topic 6, compute and investment 5 (title only), analysis 4 (title only), else paper/update 3 |
| Benchmarks | 0–12 | 6 for any benchmark, +3 per reported score, +2 per extra benchmark |
| Frontier signals | 0–14 | 7 per signal: AGI or superintelligence, AI improving AI, human-level or beyond, new best result, dangerous capability |
| Capability areas | 0–9 | 3 per capability topic (not inherited ones) |
| Watched people | 0–10 | 5 per person on the watchlist |
| Community attention | 0–10 | 4 × log10(1 + outside score), from HN points, HF upvotes or citations |

## Why these weights
- Evidence and coverage dominate so that a claim many independent sources picked up outranks a single press release.
- Releases and safety findings sit at the top of "kind" because they are what readers of a superintelligence tracker most need to see.
- Benchmarks reward reported numbers, since they make a claim checkable.
- Frontier phrases are capped at two signals, so hype words alone can't top the feed.

## Feed ranking
`rank` in `server.js` mixes votes, coverage, outside score and significance/25, divided by age. The "Significance" sort uses the score alone.
