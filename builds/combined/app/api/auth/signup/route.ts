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
import { decideSignup, emailDomain } from "@/lib/limits";
import { getSignupVelocity, hashIp, recordSignupEvent } from "@/lib/usage";

// Sign-up guard order: burst limiter → honeypot → per-network & global velocity → validation → insert.
// Every attempt is recorded against a salted IP hash so repeat-signup networks surface on /limits.

export async function POST(request: Request): Promise<Response> {
  const ip = clientIpFromRequest(request);
  const ipHash = hashIp(ip);
  const wantJson = prefersJsonResponse(request);

  const fail = (code: string, message: string, status: number, returnTo = "/") =>
    wantJson
      ? NextResponse.json({ error: message, code }, { status })
      : redirectTo(request, `/signup?error=${encodeURIComponent(code)}&returnTo=${encodeURIComponent(returnTo)}`);

  if (!checkRateLimit(`signup:${ip}`, 10, 600_000)) {
    await recordSignupEvent({ ipHash, outcome: "throttled", reason: "Burst limiter" });
    return fail("rate", "Too many sign-up attempts. Please wait a few minutes and try again.", 429);
  }

  let username = "";
  let email = "";
  let password = "";
  let website = "";
  let returnTo = "/";

  if (request.headers.get("content-type")?.includes("application/json")) {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    username = typeof body.username === "string" ? body.username : "";
    email = typeof body.email === "string" ? body.email : "";
    password = typeof body.password === "string" ? body.password : "";
    website = typeof body.website === "string" ? body.website : "";
    returnTo = safeReturnPath(typeof body.returnTo === "string" ? body.returnTo : "/");
  } else {
    const form = await request.formData();
    username = String(form.get("username") ?? "");
    email = String(form.get("email") ?? "");
    password = String(form.get("password") ?? "");
    website = String(form.get("website") ?? "");
    returnTo = safeReturnPath(form.get("returnTo"));
  }

  if (isBotHoneypotTriggered(website)) {
    await recordSignupEvent({ ipHash, outcome: "bot", reason: "Honeypot filled" });
    return fail("invalid", "Could not create the account. Please try again.", 400, returnTo);
  }

  const decision = decideSignup(await getSignupVelocity(ipHash));
  if (!decision.allow) {
    await recordSignupEvent({ ipHash, outcome: decision.outcome, reason: decision.reason, emailDomain: emailDomain(email) || null });
    return fail(
      decision.outcome === "blocked" ? "network" : "rate",
      decision.outcome === "blocked"
        ? "This network has created the maximum number of accounts today."
        : "Too many sign-ups right now. Please try again later.",
      429,
      returnTo,
    );
  }

  const result = await registerUser({ username, email, password, ipHash });
  if (!result.ok) {
    await recordSignupEvent({ ipHash, outcome: "rejected", reason: result.code, emailDomain: emailDomain(email) || null });
    return fail(result.code, result.message, result.code === "taken" || result.code === "email_taken" ? 409 : 400, returnTo);
  }

  await recordSignupEvent({
    ipHash,
    outcome: "created",
    reason: decision.watch ? "watch: repeat network" : "",
    emailDomain: emailDomain(email),
  });
  await createSessionForUser(result.userId);
  if (wantJson) {
    return NextResponse.json({ ok: true, user: { id: result.userId, username: result.username } }, { status: 201 });
  }
  return redirectTo(request, returnTo);
}
