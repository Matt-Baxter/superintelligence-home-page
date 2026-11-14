import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { listSavedStories } from "@/lib/stories";
import { StoryCard } from "../StoryCard";

// The signed-in user's saved stories. (REQ-014)

export const dynamic = "force-dynamic";
export const metadata = { title: "Saved · Superintelligence Homepage" };

export default async function SavedPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");
  const stories = await listSavedStories(user.id);
  return (
    <>
      <h1 className="page-title">Saved stories</h1>
      {stories.length === 0 ? (
        <p className="empty">You haven&apos;t saved any stories yet.</p>
      ) : (
        stories.map((story) => <StoryCard key={story.id} story={story} returnTo="/saved" />)
      )}
    </>
  );
}
