import { NextResponse } from "next/server";
import { createSessionForUser, registerUser } from "@/lib/auth";
import {
  checkRateLimit,
  clientIpFromRequest,
  isBotHoneypotTriggered,
  prefersJsonResponse,
  redirectTo,
  safeReturnPath,
} from "@/lib/guards";

export async function POST(request: Request): Promise<Response> {
  const ip = clientIpFromRequest(request);
  const wantJson = prefersJsonResponse(request);

  if (!checkRateLimit(`signup:${ip}`, 25, 600_000)) {
    const msg = "Too many sign-up attempts. Please wait a few minutes and try again.";
    return wantJson
      ? NextResponse.json({ error: msg }, { status: 429 })
      : redirectTo(request, `/signup?error=${encodeURIComponent("rate")}`);
  }

  let username = "";
  let password = "";
  let website = "";
  let returnTo = "/";

  if (request.headers.get("content-type")?.includes("application/json")) {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    username = typeof body.username === "string" ? body.username : "";
    password = typeof body.password === "string" ? body.password : "";
    website = typeof body.website === "string" ? body.website : "";
    returnTo = safeReturnPath(typeof body.returnTo === "string" ? body.returnTo : "/");
  } else {
    const form = await request.formData();
    username = String(form.get("username") ?? "");
    password = String(form.get("password") ?? "");
    website = String(form.get("website") ?? "");
    returnTo = safeReturnPath(form.get("returnTo"));
  }

  if (isBotHoneypotTriggered(website)) {
    const msg = "Could not create the account. Please try again.";
    return wantJson ? NextResponse.json({ error: msg }, { status: 400 }) : redirectTo(request, "/signup?error=invalid");
  }

  const result = await registerUser(username, password);
  if (!result.ok) {
    if (wantJson) {
      return NextResponse.json(
        { error: result.message, code: result.code },
        { status: result.code === "taken" ? 409 : 400 },
      );
    }
    return redirectTo(
      request,
      `/signup?error=${encodeURIComponent(result.code)}&returnTo=${encodeURIComponent(returnTo)}`,
    );
  }

  await createSessionForUser(result.userId);
  if (wantJson) {
    return NextResponse.json({ ok: true, user: { id: result.userId, username: result.username } }, { status: 201 });
  }
  return redirectTo(request, returnTo);
}
