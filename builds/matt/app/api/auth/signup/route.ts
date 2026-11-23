import { createSession, signUp } from "@/lib/auth";
import { redirectTo } from "@/lib/redirect";

// POST /api/auth/signup — create an account and sign in. (REQ-009, REQ-010)
export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const username = String(form.get("username") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const result = await signUp(username, password);
    if (!result.ok) {
      return redirectTo(request, `/signup?error=${result.error}`);
    }
    await createSession(result.userId);
    return redirectTo(request, "/");
  } catch (err) {
    console.error("Sign-up failed:", err);
    return redirectTo(request, "/signup?error=server");
  }
}
