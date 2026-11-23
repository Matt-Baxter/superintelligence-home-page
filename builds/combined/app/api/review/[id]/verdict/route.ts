import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prefersJsonResponse, redirectTo, safeReturnPath } from "@/lib/guards";
import { recordVerdict, VerdictInputSchema } from "@/lib/review-queue";
import { consumeQuota, quotaErrorResponse } from "@/lib/usage";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await context.params;
  const wantJson = prefersJsonResponse(request);
  if (!/^\d{1,18}$/.test(id)) return NextResponse.json({ error: "Unknown story." }, { status: 404 });

  const user = await getCurrentUser();
  if (!user) {
    return wantJson
      ? NextResponse.json({ error: "Sign in to review stories." }, { status: 401 })
      : redirectTo(request, "/signin");
  }

  const isJson = request.headers.get("content-type")?.includes("application/json");
  const raw: Record<string, unknown> = isJson
    ? ((await request.json().catch(() => ({}))) as Record<string, unknown>)
    : Object.fromEntries((await request.formData().catch(() => new FormData())).entries());

  const parsed = VerdictInputSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid verdict." }, { status: 400 });
  }

  const quota = await consumeQuota({ actor: `u:${user.id}`, tier: user.tier, action: "review_verdict" });
  if (!quota.ok) return quotaErrorResponse(quota);

  const result = await recordVerdict({ userId: user.id, storyId: id, ...parsed.data });
  if (!result.ok) {
    return NextResponse.json({ error: "This story is no longer waiting for review." }, { status: 409 });
  }

  if (wantJson) return NextResponse.json({ ok: true, consensus: result.consensus });
  return redirectTo(request, safeReturnPath(typeof raw.returnTo === "string" ? raw.returnTo : null, "/queue"));
}
