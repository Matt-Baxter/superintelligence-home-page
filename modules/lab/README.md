# lab

Superintelligence ideas, restated in our own words, reproduced as small deterministic experiments, then pushed with a hypothesis of ours. Recursive self-improvement is the centre. Extended version only; page `/m/lab`.

## Examples (`examples.json`)

| Example | Idea | Our hypothesis | Result at toy scale |
| --- | --- | --- | --- |
| `rsi-compounding` | Self-improvement compounds into an explosion | Diminishing returns plus a bottleneck at least double the time to 10x | Supported (25 to 53 generations) |
| `rsi-decision-gym` | A system that writes its own tests and learns from its mistakes improves itself | 8 rounds raise held-out accuracy by 20+ points with every safety property intact | Supported (0.76 to 0.99) |
| `rsi-ratchet-off` | Keep a change only when a measurement says it helped | With a noisy self-check, turning the ratchet off ends lower | Supported on average over 10 seeds (0.949 vs 0.932; the ratchet wins on 8 of 10). On a single seed it can go either way, which is why this one averages. |
| `goodhart-oversight` | Optimising a proxy eventually hurts the real goal | Auditing 20% of steps halves the gap | **Not supported**: the gap fell 28%, not 50% |
| `weak-to-strong` | A strong student beats its weak supervisor | Dropping the supervisor's least-confident labels helps further | Supported (0.93 to 0.96) |
| `scaling-data-limited` | Loss falls as a power law in size | With little data, gains stop early and loss is worse | Supported |

Rules for adding one:
- Restate the idea in plain words: no copied text, and no claims or quotes attributed to people.
- State a prediction (metric, direction, and optionally a factor or delta) before running.
- Keep refuted hypotheses: they are results too.

## The decision gym (`gym.js`)

The gym routes requests (from a person or another agent) to actions:
- build a dashboard;
- analyse media;
- summarise a paper;
- run an experiment;
- build an app;
- refuse.

**The policy.** A decision list, which is a one-sided decision tree, compiled to **si-expr JSON**, so the learned policy runs unchanged in Node, Python, Rust and WebAssembly. Python matches Node on 300 of 300 new requests. Hard rules sit on top and are never learned: Twitter/X links, and writing in a real person's voice.

**Each round:**
1. The policy writes its own test requests.
2. It adds the ones it got wrong to its training data.
3. It retrains.
4. It keeps the new policy only if held-out accuracy didn't drop and all 4 properties hold.

**Where it shows up:** `POST /api/lab/intent` uses it. A "build a dashboard" request is executed on the spot: a json-render spec is built from live data and validated against the block catalog.

## Autoresearch ratchet (`npm run lab`)

```bash
npm run lab -- list
npm run lab -- run                                   # every example: reproduction vs hypothesis
npm run lab -- explore rsi-decision-gym --budget 20  # deterministic coordinate search (free)
npm run lab -- explore weak-to-strong --provider ollama --model gemma3:12b   # a local model proposes changes
npm run lab -- export                                # out/lab/train-sft.jsonl and train-dpo.jsonl
npm run lab -- intent "build a dashboard of compute trends"
```

Each step proposes parameters, runs them (milliseconds, deterministic), and keeps the change only if the target metric improves. Runs are appended to `out/lab/results.tsv`, and to `lab_runs` when `DATABASE_URL` or `DATA_DIR` is set.

## Free and commodity ways to run it

- **Mac mini or any laptop:**
  - install [Ollama](https://ollama.com), then run `ollama pull gemma3:12b` (multimodal) and `ollama pull embeddinggemma` (embeddings for the knowledge layer);
  - run `npm run lab -- explore <example> --provider ollama`.
  - LM Studio works the same way (`--provider lmstudio`).
- **Free tiers:**
  - `--provider openrouter` (`OPENROUTER_API_KEY`, `:free` models);
  - `vercel-ai-gateway` (`AI_GATEWAY_API_KEY`, free-tier models);
  - `cloudflare` (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, 10,000 Neurons a day);
  - `groq` (`GROQ_API_KEY`).
  - The default model ids are best guesses; check each provider's model list and set `--model` or `LLM_MODEL`.
- **Cline:** its free models only work inside Cline (no API), so run the commands above from Cline's terminal the way you would from Claude Code. Cline is the driver, not the provider.
- **Sandboxes:** see `docs/RESEARCH_AGENTS_SANDBOXES.md`. Deterministic runs need no sandbox. For model-written code, use Vercel Sandbox, E2B or Daytona, never the web server.

## Fine-tuning Gemma on the loop's own decisions (Mac mini, MLX)

`export` writes chat-format SFT rows (prompt: the program and history; answer: params that were kept) and DPO pairs (kept preferred over rejected). On Apple silicon:

```bash
pip install mlx-lm
mkdir -p data && cp out/lab/train-sft.jsonl data/train.jsonl && cp out/lab/train-sft.jsonl data/valid.jsonl
mlx_lm.lora --model google/gemma-3-12b-it --train --data data --iters 200 --batch-size 1 --num-layers 8
```

Then serve the adapter (`mlx_lm.server --model google/gemma-3-12b-it --adapter-path adapters`) and point `--provider lmstudio` (or `LMSTUDIO_BASE=http://localhost:8080/v1`) at it. That closes the loop: the model that proposes changes is trained on which of its proposals survived the ratchet.

Not run here: this cloud session has no GPU and no Apple silicon, so the fine-tuning commands are written from MLX's documented interface and untested in this repo. Everything else above was run.
