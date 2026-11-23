import { NextResponse } from "next/server";
import { buildStoryAuditPayload, getOrComputeJit, scopedJitKey } from "@/lib/jit";
import { getStoryById } from "@/lib/stories";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  if (!/^\d{1,18}$/.test(id)) {
    return NextResponse.json({ error: "Invalid story identifier." }, { status: 400 });
  }

  const payload = await getOrComputeJit(scopedJitKey("story-audit", id), 30_000, async () => {
    const story = await getStoryById(id);
    return story ? buildStoryAuditPayload(story) : null;
  });

  if (!payload) {
    return NextResponse.json({ error: "Story not found." }, { status: 404 });
  }

  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": "public, max-age=30, stale-while-revalidate=120",
      "X-JIT-Mode": "on-demand",
    },
  });
}
