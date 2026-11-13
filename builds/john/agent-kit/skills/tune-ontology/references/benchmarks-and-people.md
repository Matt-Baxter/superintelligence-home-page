# Benchmarks and the people watchlist

## Benchmarks (`benchmarks` in lib/ontology.json)
`{ "id", "label", "measures": <topic id>, "terms": [...], "unit"?: "time", "generic"?: true }`
- `measures` must be a topic id (coding, math, reasoning, science, agents, long-horizon, automating-ai-research, multimodal, security, economics, capabilities). The Capabilities page groups by it.
- `lib/analysis.js` reads the number closest to the name within about 70 characters: a percentage by default, or a duration converted to hours when `unit` is `time`. A number larger than 100 isn't treated as a percentage.
- Put specific variants before the generic one and mark the generic one `"generic": true` (SWE-bench Verified before SWE-bench), so a story isn't counted twice.
- Add a unit check in `test/analysis-unit.js` with a synthetic sentence for any new score pattern.

## People (`people`)
`{ "id", "label", "terms": ["full name", ...] }`
- Public researchers, lab leaders and writers whose work tracks AI progress. Full names only (no surnames alone, no handles).
- The watchlist is for matching names in titles, summaries and author lists. Never write claims, quotes or results attributed to anyone, in code, fixtures or docs.
- Include critics and skeptics as well as optimists; the point is coverage, not a side.
- If the person has their own blog or newsletter, also add it as a `people` source (add-sources skill).
