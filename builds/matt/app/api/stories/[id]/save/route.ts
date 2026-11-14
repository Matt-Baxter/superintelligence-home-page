import { handleInteraction } from "@/lib/interaction-route";

// POST /api/stories/<id>/save — toggle the signed-in user's save. (REQ-014, REQ-015, REQ-016)
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return handleInteraction(request, id, "save");
}
