# Feed formats and URL patterns

| Format | URL pattern | Notes |
| --- | --- | --- |
| `rss` | Site feed (RSS 2.0 or Atom) | Substack `https://<name>.substack.com/feed`; Ghost `/rss/`; Hugo `/index.xml`; Jekyll `/feed.xml`; WordPress `/feed/`; Medium `https://medium.com/feed/@<user>`; Reddit `https://www.reddit.com/r/<sub>/top/.rss?t=day`; GitHub `https://github.com/<org>/<repo>/releases.atom`; OJS journals `/gateway/plugin/WebFeedGatewayPlugin/rss2`; Nature journals `https://www.nature.com/<code>.rss` |
| `arxiv` | `https://export.arxiv.org/api/query?search_query=<q>&sortBy=submittedDate&sortOrder=descending&max_results=40` | `<q>` like `cat:cs.CL` or `all:%22time%20horizon%22%20AND%20all:agents`. Items group with other sources by arXiv id. |
| `jsonfeed` | A JSON Feed 1.x URL | |
| `hf-daily` | `https://huggingface.co/api/daily_papers` | Upvotes become the outside score |
| `hn-algolia` | `https://hn.algolia.com/api/v1/search_by_date?query=AI&tags=story&numericFilters=points%3E100&hitsPerPage=40` | Links to the story's URL (so it groups with the original); points become the outside score |
| `semantic-scholar` | `https://api.semanticscholar.org/graph/v1/paper/search/bulk?query=<q>&fields=title,url,abstract,authors,publicationDate,externalIds,citationCount,venue&sort=publicationDate:desc` | Add `venue=NeurIPS,ICML,ICLR` or `venue=Nature,Science` and `year=2025-` to target proceedings and journals; `|` means OR, quotes for phrases. Prefers the arXiv link when there is one; citations become the outside score. Rate-limited without a key. |

## Choosing kinds for people and publications
- A named researcher's or writer's own blog: `people`. Add their name to the people watchlist too (tune-ontology).
- A peer-reviewed journal or proceedings search: `journal`.
- An evaluation or forecasting organization (Epoch, METR, Apollo): `research-org`.
- A group newsletter that mostly links elsewhere: `newsletter`.
