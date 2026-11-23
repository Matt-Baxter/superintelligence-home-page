import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { listSavedStories } from "@/lib/stories";
import { consumeQuota, quotaErrorResponse } from "@/lib/usage";

function csvCell(val: string | number): string {
  const s = String(val ?? "");
  return /[",\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

// Authenticated per-user saved-list export as JSON or CSV (REQ-C08 / REQ-049; strictly user-scoped).
export async function GET(request: Request): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Please sign in to export your saved stories." }, { status: 401 });
  }

  const quota = await consumeQuota({ actor: `u:${user.id}`, tier: user.tier, action: "export" });
  if (!quota.ok) return quotaErrorResponse(quota);

  const url = new URL(request.url);
  const format = (url.searchParams.get("format") ?? "json").toLowerCase();
  const saved = await listSavedStories(user.id);

  if (format === "csv") {
    const header = ["id", "title", "url", "publishedAt", "significanceScore", "topics", "sources"].join(",");
    const lines = saved.map((s) =>
      [
        csvCell(s.id),
        csvCell(s.title),
        csvCell(s.url),
        csvCell(s.publishedAt.toISOString()),
        csvCell(s.significanceScore),
        csvCell(s.rootTopics.map((t) => t.label).join("; ")),
        csvCell(s.sources.map((src) => src.name).join("; ")),
      ].join(","),
    );
    return new Response([header, ...lines].join("\n"), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="saved-stories-${user.username}.csv"`,
      },
    });
  }

  return NextResponse.json(
    {
      exportedAt: new Date().toISOString(),
      username: user.username,
      count: saved.length,
      stories: saved.map((s) => ({
        id: s.id,
        title: s.title,
        url: s.url,
        publishedAt: s.publishedAt.toISOString(),
        significanceScore: s.significanceScore,
        aiScore: s.aiScore,
        topics: s.rootTopics.map((t) => ({ id: t.id, label: t.label, matched: t.matched })),
        sources: s.sources.map((src) => ({ name: src.name, url: src.url })),
      })),
    },
    {
      headers: {
        "Content-Disposition": `attachment; filename="saved-stories-${user.username}.json"`,
      },
    },
  );
}
