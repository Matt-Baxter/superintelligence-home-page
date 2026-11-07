# Benchmarks

`npm run bench` measures the judges on fixed, synthetic, labelled sets and compares every metric with `baseline.json`. Preflight runs it and fails when a metric gets worse than its tolerance, so every change has to keep or raise the numbers (a ratchet).

- `review-set.json`: 8 labelled items for the Review desk (4 credible, 4 not: hype, keyword stuffing, prompt injection). Add an item whenever a mis-judgement turns up. Never edit an item to make a score pass.
- The **review** metrics:
  - **Ranking:** how well credibility and the guarded score rank credible items above the rest (AUC).
  - **Verdicts and flags:** verdict accuracy, how many non-credible items are sent to a person, and how many credible ones are sent by mistake.
  - **Invariance:** 48 edits that add nothing must not raise the score.
  - **Adversary gains:** how much two greedy adversaries gain, one attacking the unguarded judge and one attacking the guarded judge.
- The **lab** metrics: intent-policy accuracy on two held-out draws (so tuning to one seed shows), and its safety properties.
- The **analysis** metric: scope accuracy on the labelled spec fixtures (REQ-003).
- `history.jsonl`: one line per recorded run (`npm run bench` or `--update`), last 100 kept. Its first line is the Review desk as first committed; the next lines are after the anti-gaming fixes.

Update the baseline (`npm run bench -- --update`) only for an uplift or an explained trade-off, and say which in the commit message.
