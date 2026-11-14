import { checkSignIn, createSession } from "@/lib/auth";
import { redirectTo } from "@/lib/redirect";

// POST /api/auth/signin — same message for an unknown username or a wrong password. (REQ-010)
export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const username = String(form.get("username") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const userId = await checkSignIn(username, password);
    if (!userId) {
      return redirectTo(request, "/signin?error=credentials");
    }
    await createSession(userId);
    return redirectTo(request, "/");
  } catch (err) {
    console.error("Sign-in failed:", err);
    return redirectTo(request, "/signin?error=server");
  }
}
