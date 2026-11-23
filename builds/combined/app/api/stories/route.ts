import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { parseFeedQuery } from "@/lib/schemas";
import { listStories } from "@/lib/stories";

// Machine-readable JSON twin of the filtered Superintelligence feed (REQ-C08).
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const rawParams: Record<string, string> = {};
  for (const [k, v] of url.searchParams.entries()) {
    rawParams[k] = v;
  }

  const query = parseFeedQuery(rawParams);
  const user = await getCurrentUser().catch(() => null);
  const data = await listStories(query, user?.id);

  return NextResponse.json({
    schemaVersion: "si-feed-v1",
    query,
    totalMatching: data.totalMatching,
    hasMore: data.hasMore,
    activeSourceCount: data.activeSourceCount,
    activeKindCount: data.activeKindCount,
    topicCounts: data.topicCounts,
    stories: data.stories,
  });
}
