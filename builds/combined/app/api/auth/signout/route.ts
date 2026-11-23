import { NextResponse } from "next/server";
import { destroyCurrentSession } from "@/lib/auth";
import { prefersJsonResponse, redirectTo } from "@/lib/guards";

export async function POST(request: Request): Promise<Response> {
  await destroyCurrentSession();
  if (prefersJsonResponse(request)) {
    return NextResponse.json({ ok: true });
  }
  return redirectTo(request, "/");
}
