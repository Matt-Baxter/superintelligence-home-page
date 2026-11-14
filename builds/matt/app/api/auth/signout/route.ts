import { destroySession } from "@/lib/auth";
import { redirectTo } from "@/lib/redirect";

// POST /api/auth/signout — end the session and clear the cookie. (REQ-010)
export async function POST(request: Request) {
  try {
    await destroySession();
  } catch (err) {
    console.error("Sign-out failed:", err);
  }
  return redirectTo(request, "/");
}
