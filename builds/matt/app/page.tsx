import { getCurrentUser } from "@/lib/auth";
import { listStories } from "@/lib/stories";
import { StoryCard } from "./StoryCard";

// The superintelligence feed. (REQ-002 to REQ-007, REQ-013, REQ-014, REQ-021)

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const params = await searchParams;
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const user = await getCurrentUser();
  const { stories, hasMore } = await listStories({ page, userId: user?.id });
  const returnTo = page > 1 ? `/?page=${page}` : "/";

  if (stories.length === 0 && page === 1) {
    return <p className="empty">No superintelligence stories yet. Check back soon.</p>;
  }

  return (
    <>
      <h1 className="visually-hidden">Superintelligence feed</h1>
      {stories.map((story) => (
        <StoryCard key={story.id} story={story} returnTo={returnTo} />
      ))}
      <nav className="pager" aria-label="More stories">
        {page > 1 && <a href={page === 2 ? "/" : `/?page=${page - 1}`}>Newer stories</a>}
        {hasMore && <a href={`/?page=${page + 1}`}>Older stories</a>}
      </nav>
    </>
  );
}
