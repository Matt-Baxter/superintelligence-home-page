# knowledge

Stories are split into chunks (titles and summaries only, never full text: REQ-007). Each chunk is tagged by every registered tagger, embedded locally, and the tags are linked into a graph of qualified ids. Extended version only.

- **Taggers:** `lib/taggers` registry (ontology topics, organisations, benchmarks, people) plus module adapters through the `knowledge.taggers` extension point. Learn adds `concepts` and curated concept edges.
- **Embedders:** `hash-256` (free, local, deterministic); `minilm` (transformers.js, optional). Add more as adapters (the add-an-adapter skill).
- **Graph:**
  - `co-occurs` links two tags on the same chunk, with weight and evidence;
  - curated `part-of`, `about`, `needs`, `leads-to`, `contrasts`, `related` come from adapters' `edges()`.
- **Index:** `POST /api/admin/knowledge/build` rebuilds on demand (nothing runs on a timer) and skips chunks whose text hash is unchanged. Only the newest 2,000 stories are kept.
- **API:** `/api/knowledge/graph`, `/chunks`, `/similar`, `/export.jsonld` and `/context.jsonld`, plus JSON-RPC 2.0 at `/api/knowledge/rpc`, described in `schema/gen/openrpc.json` and as a gRPC service in `schema/gen/si.proto`.
- **Page:** `/m/knowledge` (admins).
