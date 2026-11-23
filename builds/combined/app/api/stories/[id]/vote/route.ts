import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prefersJsonResponse, redirectTo, safeReturnPath } from "@/lib/guards";
import { toggleUserInteraction } from "@/lib/interactions";
import { consumeQuota, quotaErrorResponse } from "@/lib/usage";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  const wantJson = prefersJsonResponse(request);
  const user = await getCurrentUser();

  if (!user) {
    return wantJson
      ? NextResponse.json({ error: "Please sign in to vote on stories." }, { status: 401 })
      : redirectTo(request, "/signin");
  }

  const url = new URL(request.url);
  let returnTo = "/";
  let claimedUserId: string | null = url.searchParams.get("userId") ?? url.searchParams.get("user_id");

  if (request.headers.get("content-type")?.includes("application/json")) {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    if (typeof body.returnTo === "string") returnTo = safeReturnPath(body.returnTo);
    if (body.userId !== undefined) claimedUserId = String(body.userId);
    if (body.user_id !== undefined) claimedUserId = String(body.user_id);
  } else {
    const form = await request.formData().catch(() => null);
    if (form) {
      returnTo = safeReturnPath(form.get("returnTo"));
      const formUid = form.get("userId") ?? form.get("user_id");
      if (typeof formUid === "string") claimedUserId = formUid;
    }
  }

  const quota = await consumeQuota({ actor: `u:${user.id}`, tier: user.tier, action: "vote" });
  if (!quota.ok) return quotaErrorResponse(quota);

  const outcome = await toggleUserInteraction({
    kind: "vote",
    sessionUserId: user.id,
    storyId: id,
    claimedUserId,
  });

  if (!outcome.ok) {
    return wantJson
      ? NextResponse.json({ error: outcome.error }, { status: outcome.status })
      : new Response(outcome.error, { status: outcome.status });
  }

  if (wantJson) {
    return NextResponse.json({ ok: true, voted: outcome.active, votes: outcome.votesCount });
  }
  return redirectTo(request, returnTo);
}
