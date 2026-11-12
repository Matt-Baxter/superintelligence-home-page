#!/bin/sh
# Scheduled run of every training loop (scripts/train.js all) for a machine with no memory between runs, such as a
# cloud task. Each run takes the next shard of seeds, so successive days add new evidence instead of repeating it, and
# keeps results on their own branch (default results/training-loop) so the merge pools every run so far.
#
#   sh scripts/train-scheduled.sh                  today's shard, push results
#   SHARD=4 PER_RUN=20 INTRO_PER_RUN=0 PUSH=0 sh scripts/train-scheduled.sh    a small local test, nothing pushed
#
# Env: SHARDS (30), PER_RUN seeds per experiment (300), INTRO_PER_RUN introspection seeds (60), RESULTS_BRANCH,
#      PUSH (1), GIT_AUTHOR (name <email>) for the results commit.
set -eu
ROOT=$(cd "$(dirname "$0")/.." && pwd); cd "$ROOT"
BRANCH=${RESULTS_BRANCH:-results/training-loop}
SHARDS=${SHARDS:-30}; PER_RUN=${PER_RUN:-300}; INTRO_PER_RUN=${INTRO_PER_RUN:-60}; PUSH=${PUSH:-1}
I=${SHARD:-$(( $(date -u +%s) / 86400 % SHARDS ))}
DIR="$ROOT/out/results-worktree"

# Results branch in a separate worktree: reuse it if it exists on the remote, otherwise start it empty.
git worktree remove -f "$DIR" 2>/dev/null || rm -rf "$DIR"
if git fetch -q --depth=1 origin "+refs/heads/$BRANCH:refs/remotes/origin/$BRANCH" 2>/dev/null; then
  git worktree add -q -B "$BRANCH" "$DIR" "origin/$BRANCH"
else
  git worktree add -q --detach "$DIR"; git -C "$DIR" checkout -q --orphan "$BRANCH"; git -C "$DIR" rm -rq --cached . ; find "$DIR" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
  printf '# Training loop results\n\nWritten by scripts/train-scheduled.sh; one folder per shard under loop/, pooled in loop/report.md. No code here.\n' > "$DIR/README.md"
fi

INTRO=0; [ "$INTRO_PER_RUN" -gt 0 ] && INTRO=$(( INTRO_PER_RUN * SHARDS ))
echo "shard $I/$SHARDS: $PER_RUN seeds per experiment, $INTRO_PER_RUN introspection seeds -> $BRANCH"
LOOP_DIR="$DIR/loop" LOOP_HOST="cloud-shard-$I" node scripts/train.js all --shard "$I/$SHARDS" --seeds $(( PER_RUN * SHARDS )) --introspection "$INTRO" --no-lean
mkdir -p "$DIR/train"; cp out/train/manifest.json "$DIR/train/manifest.json"

AUTHOR=${GIT_AUTHOR:-$(git log -1 --format='%an <%ae>')}
NAME=${AUTHOR% <*}; EMAIL=$(echo "$AUTHOR" | sed 's/.*<\(.*\)>.*/\1/')
git -C "$DIR" add -A
SUMMARY=$(grep -E '^\| [a-zA-Z0-9 -]+ \| .* \| (supported|not supported|undecided|too few)' "$DIR/loop/report.md" | awk -F'|' '{gsub(/^ +| +$/,"",$2); split($5,v," \\("); gsub(/^ +/,"",v[1]); printf "%s: %s; ", $2, v[1]}')
git -C "$DIR" -c user.name="$NAME" -c user.email="$EMAIL" commit -q -m "Training run: shard $I/$SHARDS from $(git rev-parse --short HEAD)

$SUMMARY" || { echo "nothing new to commit"; exit 0; }
if [ "$PUSH" = 1 ]; then git -C "$DIR" -c push.negotiate=true push -q --no-verify origin "HEAD:refs/heads/$BRANCH"; echo "pushed $BRANCH $(git -C "$DIR" rev-parse --short HEAD)"; else echo "PUSH=0: committed locally only"; fi
