import { NextResponse } from "next/server";
import { createSessionForUser, verifyCredentials } from "@/lib/auth";
import {
  checkRateLimit,
  clientIpFromRequest,
  prefersJsonResponse,
  redirectTo,
  safeReturnPath,
} from "@/lib/guards";

export async function POST(request: Request): Promise<Response> {
  const ip = clientIpFromRequest(request);
  const wantJson = prefersJsonResponse(request);

  if (!checkRateLimit(`signin:${ip}`, 30, 600_000)) {
    const msg = "Too many sign-in attempts. Please wait a few minutes and try again.";
    return wantJson
      ? NextResponse.json({ error: msg }, { status: 429 })
      : redirectTo(request, "/signin?error=rate");
  }

  let username = "";
  let password = "";
  let returnTo = "/";

  if (request.headers.get("content-type")?.includes("application/json")) {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    username = typeof body.username === "string" ? body.username : "";
    password = typeof body.password === "string" ? body.password : "";
    returnTo = safeReturnPath(typeof body.returnTo === "string" ? body.returnTo : "/");
  } else {
    const form = await request.formData();
    username = String(form.get("username") ?? "");
    password = String(form.get("password") ?? "");
    returnTo = safeReturnPath(form.get("returnTo"));
  }

  const user = await verifyCredentials(username, password);
  if (!user) {
    const msg = "Incorrect username or password.";
    if (wantJson) {
      return NextResponse.json({ error: msg }, { status: 401 });
    }
    return redirectTo(request, `/signin?error=credentials&returnTo=${encodeURIComponent(returnTo)}`);
  }

  await createSessionForUser(user.id);
  if (wantJson) {
    return NextResponse.json({ ok: true, user });
  }
  return redirectTo(request, returnTo);
}
