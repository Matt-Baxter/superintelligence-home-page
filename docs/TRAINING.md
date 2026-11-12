# Training and self-improvement loops

Every loop that trains, tunes or self-improves something in this repo, in one place. Each loop keeps its own code;
[`scripts/train.js`](../scripts/train.js) runs them in order and reports where each stands.

```bash
npm run train              # status: what each loop last produced, and when
npm run train:cycle        # research loop: checks, bench, ratchet dry run, seeded experiments, merge
npm run train:data         # Lab ratchet over every example, then a split fine-tuning dataset in out/train
npm run train:all          # all of the above
node scripts/train.js all --shard 0/3 --seeds 300 --introspection 60   # one machine's share of a multi-machine run
```

Nothing here commits or pushes. Outputs are git-ignored: `LOOP_DIR` (default `out/loop`), `out/lab`, `out/train`.

## The loops

| Loop | What it trains or tunes | Code | Output |
| --- | --- | --- | --- |
| Research loop | Seeded experiments for the Lab's pre-registered hypotheses, pooled across machines into 95% intervals | [`scripts/research-loop.js`](../scripts/research-loop.js) | `LOOP_DIR/<host>/latest.json`, `LOOP_DIR/report.md` |
| Introspection | Small networks trained to report a concept; reports checked with interchange interventions (H7) | [`research/introspection/introspect.py`](../research/introspection/introspect.py) | inside the research loop's samples |
| Verification ratchet | Edits verification rules; keeps an edit only if train improves and held-out holds | [`scripts/verification-ratchet.js`](../scripts/verification-ratchet.js) | dry run inside each cycle |
| Lab ratchet | Autoresearch ratchet over each Lab example, deterministic or model proposer | [`scripts/lab.js`](../scripts/lab.js) `explore` | `out/lab/explore-*.json`, `out/lab/results.tsv` |
| Fine-tuning data | SFT rows (kept steps) and DPO pairs (kept over rejected) from the Lab ratchet | `scripts/train.js data` | `out/train/{train,valid,test}.jsonl`, `dpo-*.jsonl`, `manifest.json` |
| Gemma LoRA | Local fine-tune on `out/train` (MLX, Apple silicon only) | [`modules/lab/README.md`](../modules/lab/README.md) | `adapters/` |

## Fine-tuning data rules

- Split by example family (the Lab runner), never by row, so no family appears in two splits. The split depends only
  on the family name (sha256 mod 10: 0-6 train, 7 valid, 8-9 test), so it is the same on every machine.
- `test` is frozen: never used for training or in prompts.
- `manifest.json` marks the data **unreviewed**. Before any LoRA run: human review of the rows, rights review, a
  recorded base-model revision, and a held-out comparison against the base model.
- The rows' `meta` field (example, family) is for review; strip it if a trainer rejects unknown fields.

## Daily cloud run

[`scripts/train-scheduled.sh`](../scripts/train-scheduled.sh) runs `train.js all` on the next of 30 seed shards (300
seeds per experiment, 60 introspection seeds) and commits the results to the `results/training-loop` branch, so each
day adds new seeds and `loop/report.md` there pools every run so far. A scheduled task runs it daily. Small local test
with nothing pushed: `SHARD=4 PER_RUN=20 INTRO_PER_RUN=2 PUSH=0 sh scripts/train-scheduled.sh`.

## Running on our machines

The Mac mini and laptops run the same command on different shards and write to one synced folder:

1. Pull the branch on each machine. Python 3 with NumPy is needed for introspection.
2. In [`scripts/launchd/ai.superintelligence.research-loop.plist`](../scripts/launchd/ai.superintelligence.research-loop.plist),
   set `REPO`, `SHARED` (the synced folder) and `SHARD` (`0/3` for the Mac mini, `1/3` and `2/3` for the laptops).
3. `cp` it to `~/Library/LaunchAgents/` and `launchctl load` it. It runs `train.js all` hourly.
4. `LOOP_DIR=<SHARED> npm run train` on any machine shows the pooled state.

The Gemma LoRA step is manual and only on Apple silicon, after the review above:

```bash
pip install mlx-lm
mlx_lm.lora --model google/gemma-3-12b-it --train --data out/train --iters 200 --batch-size 1 --num-layers 8
```

Its commands are untested in this repo (no Apple silicon in CI or cloud sessions); record the run before claiming a result.
