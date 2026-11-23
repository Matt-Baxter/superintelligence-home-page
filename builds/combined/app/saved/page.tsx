import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { StoryCard } from "@/components/story-card";
import { getCurrentUser } from "@/lib/auth";
import { listSavedStories } from "@/lib/stories";

export const metadata: Metadata = {
  title: "Saved Stories",
};

export default async function SavedStoriesPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/signin?returnTo=/saved");
  }

  const stories = await listSavedStories(user.id);

  return (
    <>
      <div className="feed-banner">
        <div>
          <h1 className="feed-heading">Saved Stories ({stories.length})</h1>
          <p className="feed-subtitle">
            Private reading list for <strong>{user.username}</strong>. Kept across sessions and redeploys; only you can view or export these items.
          </p>
        </div>
        {stories.length > 0 && (
          <div className="utility-group">
            <a href="/api/export?format=json" className="btn-secondary">
              Export JSON
            </a>
            <a href="/api/export?format=csv" className="btn-secondary">
              Export CSV
            </a>
          </div>
        )}
      </div>

      {stories.length === 0 ? (
        <div className="empty-state">
          <p className="empty-copy">You have not saved any superintelligence stories yet.</p>
          <Link href="/" className="btn-primary">
            Browse the feed
          </Link>
        </div>
      ) : (
        <div className="story-list">
          {stories.map((story) => (
            <StoryCard key={story.id} story={story} returnTo="/saved" />
          ))}
        </div>
      )}
    </>
  );
}
