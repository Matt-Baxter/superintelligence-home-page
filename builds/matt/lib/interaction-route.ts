import { getCurrentUser } from "./auth";
import { storyExists, toggle, type Interaction } from "./interactions";
import { redirectTo, safeReturnPath } from "./redirect";

// Shared handler for POST /api/stories/<id>/vote and /save. Any extra form fields (such as a
// hand-added userId) are ignored. (REQ-013 to REQ-016; contract: Form endpoints)
export async function handleInteraction(request: Request, id: string, kind: Interaction): Promise<Response> {
  try {
    const user = await getCurrentUser();
    if (!user) return redirectTo(request, "/signin");
    if (!(await storyExists(id))) {
      return new Response("That story doesn't exist.", { status: 404 });
    }
    const form = await request.formData();
    await toggle(kind, user.id, id);
    return redirectTo(request, safeReturnPath(form.get("returnTo")));
  } catch (err) {
    console.error(`Could not ${kind}:`, err);
    return new Response("Something went wrong. Please try again.", { status: 500 });
  }
}
