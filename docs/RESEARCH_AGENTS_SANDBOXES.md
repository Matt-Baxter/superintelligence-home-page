# Cheap agents, sandboxes and portable formats for the knowledge layer

Research from Nov 7, 2026 for John's request: run agents in the background to analyse and organise the knowledge graph (articles, chunks, topics, embedding tags), cheaply, with formats that work in every runtime. Prices change often, so check the linked pages before paying for anything. Nothing here is enabled by default (the free-tier rule: no paid API calls by default).

## Recommendation

1. **Do the bulk work for free, locally or in CI, and keep the web server thin.** The knowledge module's chunking, tagging (the `lib/taggers` registry), hashing embeddings and co-occurrence graph are pure JavaScript with no API calls. An admin runs them on demand (`POST /api/admin/knowledge/build`), and unchanged chunks are skipped, so this fits Vercel Hobby and Neon Free.
2. **Use a model only where judgement is needed:** plain-language explainers, paper-to-code and reverse-engineering. Those go through the Learn studio jobs: the worker writes a brief, and a person's Claude Code session or a cheap model does the work.
3. **For a model**, start with a free tier and fall back to the cheapest paid ones:
   - Free: Groq (llama-3.1-8b-instant, about 14,400 requests a day), the Gemini API free tier, OpenRouter's `:free` models (about 50 a day), Cloudflare Workers AI (10,000 Neurons a day).
   - Cheapest paid: Groq Llama 3.1 8B at $0.05 / $0.08 per million tokens in / out; Gemini 2.5 Flash-Lite at $0.10 / $0.40.
   - Use any of them through one adapter (an `embedders` or tagger adapter, or a worker job), never from the request path.
4. **For a sandbox**, when an agent must run untrusted code (paper-to-code) rather than local scripts:
   - **Vercel Sandbox:** its Hobby plan includes 5 active CPU hours a month, and the project already deploys on Vercel.
   - **E2B ($100 credit) or Daytona ($200 credit):** for bursts.
   - **GitHub Actions:** free on public repos. It's already where `interop.yml` builds Rust and WebAssembly. A scheduled workflow, at most daily, could run `npm run learn:worker`.
5. **Embeddings:**
   - **Default:** the free `hash-256` adapter (feature hashing). It's deterministic, has no download, and is good for near-duplicates and related passages.
   - **Upgrade:** for real semantic search, install `@huggingface/transformers` and switch to the `minilm` adapter, which runs all-MiniLM-L6-v2 locally in the worker (384 dimensions). For more than a few thousand chunks, move the vectors to pgvector on Neon instead of JSON text.

## Sandboxes compared

| Platform | Isolation | Free allowance | Price (about 1 vCPU, 2 GB) | Max session | Fits |
| --- | --- | --- | --- | --- | --- |
| Vercel Sandbox | Firecracker microVM | 5 active CPU-hours and 420 GB-hours a month on Hobby | $0.128 per active CPU-hour plus memory | 45 min Hobby, 24 h Pro | Already on Vercel; mostly idle agent sessions |
| E2B | Firecracker microVM | $100 one-time credit | About $0.08 an hour | 1 h Hobby, 24 h Pro | Code interpreters; pause and resume |
| Daytona | Container (VM class optional) | $200 credit | About $0.08 an hour | No maximum; stops after 15 min idle | Fast starts (about 90 ms) |
| Modal | gVisor | $30 a month credit (Starter) | About $0.12 an hour | 24 h | Python and GPU work |
| Cloudflare Sandbox | microVM per container | None ($5 a month Workers Paid) | About $0.09 an hour | Up to 6 h idle | Agents already on Workers |
| Northflank | Kata microVM / gVisor | 2 free services | From $0.017 per vCPU-hour | No limit | Lowest list price; bring your own cloud |
| Blaxel | microVM | $200 credit | About $0.08 an hour | No limit | About 25 ms resume |
| GitHub Actions | Fresh VM per job | Free for public repos; 2,000 min a month private | Free tier | 6 h a job | Daily batch jobs, builds, checks |

## One language for rules, one source for types

| Need | What we built | Standard it follows | Upgrade path |
| --- | --- | --- | --- |
| Rules as data (scope, tag explanations, filters) | **si-expr** (`lib/expr`): an AST in JSON with interpreters in Node, Python and Rust; WebAssembly is built in CI | A superset of [JSONLogic](https://jsonlogic.com), so `json-logic-js`, `json-logic-py` and `datalogic-rs` run the core operators | CEL, if we need typed expressions; JMESPath for queries |
| Types across runtimes | **schema registry** (`schema/types.json` and `lib/schema`): one file generates JSON Schema, zod, pydantic, protobuf with a gRPC service, Arrow, a JSON-LD context, OpenRPC and Rust serde structs, checked in each runtime | JSON Schema 2020-12, proto3, Arrow, JSON-LD 1.1, OpenRPC 1.3 | [LinkML](https://linkml.io), which generates the same set and more (SHACL, OWL, SQL), if the model grows |
| Protocols | JSON-RPC 2.0 at `POST /api/knowledge/rpc` (zod-checked params); a gRPC service described in `schema/gen/si.proto` | JSON-RPC 2.0, gRPC | Serve gRPC from a worker if a client needs it (Vercel functions don't do HTTP/2 streaming) |
| Linked data | `/api/knowledge/export.jsonld` with the generated context (schema.org terms) | JSON-LD 1.1, schema.org | The vocabulary is generated too: `schema/gen/vocab.md` |

## Sources

- [AI code sandbox benchmark 2026 (Superagent)](https://www.superagent.sh/blog/ai-code-sandbox-benchmark-2026)
- [AI sandbox pricing (Northflank)](https://northflank.com/blog/ai-sandbox-pricing)
- [Best AI agent sandboxes 2026 (Techplained)](https://www.techplained.com/best-ai-agent-sandboxes)
- [Best LLM API with a free tier in 2026 (Costbench)](https://www.costbench.com/best/best-llm-api-with-free-tier/)
- [Cheapest LLM APIs in 2026 (Morph)](https://www.morphllm.com/cheapest-llm)
- [LinkML generators](https://linkml.io/linkml/generators/jsonld.html)
- [datalogic-rs (JSONLogic in Rust)](https://docs.rs/crate/datalogic-rs/5.4.0/source/src/compile/walker.rs)
- [JMESPath libraries](https://jmespath.org/libraries.html)
- [Local embeddings with transformers.js (MemberJunction docs)](https://docs.memberjunction.org/packages/ai/providers/localembeddings/)
