import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prefersJsonResponse, redirectTo, safeReturnPath } from "@/lib/guards";
import { FlagInputSchema, flagStory } from "@/lib/review-queue";
import { consumeQuota, quotaErrorResponse } from "@/lib/usage";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await context.params;
  const wantJson = prefersJsonResponse(request);
  if (!/^\d{1,18}$/.test(id)) return NextResponse.json({ error: "Unknown story." }, { status: 404 });

  const user = await getCurrentUser();
  if (!user) {
    return wantJson
      ? NextResponse.json({ error: "Sign in to flag a story for review." }, { status: 401 })
      : redirectTo(request, "/signin");
  }

  const isJson = request.headers.get("content-type")?.includes("application/json");
  const raw: Record<string, unknown> = isJson
    ? ((await request.json().catch(() => ({}))) as Record<string, unknown>)
    : Object.fromEntries((await request.formData().catch(() => new FormData())).entries());

  const parsed = FlagInputSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid flag." }, { status: 400 });
  }

  const quota = await consumeQuota({ actor: `u:${user.id}`, tier: user.tier, action: "review_flag" });
  if (!quota.ok) return quotaErrorResponse(quota);

  const result = await flagStory({ storyId: id, reason: parsed.data.reason });
  if (!result.ok) return NextResponse.json({ error: "Unknown story." }, { status: 404 });

  if (wantJson) return NextResponse.json({ ok: true, alreadyQueued: result.alreadyQueued });
  return redirectTo(request, safeReturnPath(typeof raw.returnTo === "string" ? raw.returnTo : null, `/stories/${id}`));
}
