"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

interface StoryActionsBarProps {
  storyId: string;
  returnTo: string;
  initialVotes: number;
  initialVoted: boolean;
  initialSaved: boolean;
}

/**
 * Progressive-enhancement optimistic action bar:
 * - Preserves standard `<form method="post" action=...>` for no-JS & E2E form assertions.
 * - Intercepts clicks in JS for instant (<16ms) optimistic Vote/Save updates with zero scroll loss.
 * - Surfaces a calm slotted inline sign-in prompt on 401 instead of forcing an abrupt redirect.
 */
export function StoryActionsBar({
  storyId,
  returnTo,
  initialVotes,
  initialVoted,
  initialSaved,
}: StoryActionsBarProps) {
  const [votes, setVotes] = useState(initialVotes);
  const [voted, setVoted] = useState(initialVoted);
  const [saved, setSaved] = useState(initialSaved);
  const [pendingKind, setPendingKind] = useState<"vote" | "save" | null>(null);
  const [feedback, setFeedback] = useState<{ kind: "auth" | "error"; message: string } | null>(null);

  async function handleVote(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pendingKind) return;

    const prevVoted = voted;
    const prevVotes = votes;
    const nextVoted = !prevVoted;
    setVoted(nextVoted);
    setVotes(Math.max(0, prevVotes + (nextVoted ? 1 : -1)));
    setPendingKind("vote");
    setFeedback(null);

    try {
      const res = await fetch(`/api/stories/${storyId}/vote`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ returnTo }),
      });

      if (res.status === 401) {
        setVoted(prevVoted);
        setVotes(prevVotes);
        setFeedback({ kind: "auth", message: "Sign in to vote on research stories and calibrate rankings." });
        return;
      }

      const data = (await res.json().catch(() => null)) as { voted?: boolean; votes?: number; error?: string } | null;
      if (!res.ok || !data) {
        setVoted(prevVoted);
        setVotes(prevVotes);
        setFeedback({ kind: "error", message: data?.error ?? "Unable to record vote right now." });
        return;
      }

      if (typeof data.voted === "boolean") setVoted(data.voted);
      if (typeof data.votes === "number") setVotes(data.votes);
    } catch {
      setVoted(prevVoted);
      setVotes(prevVotes);
      setFeedback({ kind: "error", message: "Network interruption while recording vote." });
    } finally {
      setPendingKind(null);
    }
  }

  async function handleSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pendingKind) return;

    const prevSaved = saved;
    setSaved(!prevSaved);
    setPendingKind("save");
    setFeedback(null);

    try {
      const res = await fetch(`/api/stories/${storyId}/save`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ returnTo }),
      });

      if (res.status === 401) {
        setSaved(prevSaved);
        setFeedback({ kind: "auth", message: "Sign in to save stories to your private reading list." });
        return;
      }

      const data = (await res.json().catch(() => null)) as { saved?: boolean; error?: string } | null;
      if (!res.ok || !data) {
        setSaved(prevSaved);
        setFeedback({ kind: "error", message: data?.error ?? "Unable to update reading list." });
        return;
      }

      if (typeof data.saved === "boolean") setSaved(data.saved);
    } catch {
      setSaved(prevSaved);
      setFeedback({ kind: "error", message: "Network interruption while updating reading list." });
    } finally {
      setPendingKind(null);
    }
  }

  return (
    <>
      <div className="story-actions">
        <div className="story-actions-left">
          <form method="post" action={`/api/stories/${storyId}/vote`} onSubmit={handleVote}>
            <input type="hidden" name="returnTo" value={returnTo} />
            <button
              type="submit"
              className="action-btn btn-small"
              aria-pressed={voted}
              disabled={pendingKind === "vote"}
            >
              <span aria-hidden="true">▲</span>
              <span>{voted ? "Voted" : "Vote"}</span>
              <span className="mono-num">({votes})</span>
            </button>
          </form>

          <form method="post" action={`/api/stories/${storyId}/save`} onSubmit={handleSave}>
            <input type="hidden" name="returnTo" value={returnTo} />
            <button
              type="submit"
              className="action-btn btn-small"
              aria-pressed={saved}
              disabled={pendingKind === "save"}
            >
              {saved ? "Saved" : "Save"}
            </button>
          </form>
        </div>

        <Link href={`/stories/${storyId}`} className="provenance-link">
          Full provenance →
        </Link>
      </div>

      {feedback && (
        <div
          className={`inline-feedback-banner${feedback.kind === "error" ? " error" : ""}`}
          role="status"
          aria-live="polite"
        >
          <span>{feedback.message}</span>
          {feedback.kind === "auth" && (
            <Link href={`/signin?returnTo=${encodeURIComponent(returnTo)}`} className="btn-secondary btn-small">
              Sign in →
            </Link>
          )}
        </div>
      )}
    </>
  );
}
