import { NextResponse } from "next/server";
import { runHistoryStep } from "@/lib/history";

function authorizedCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  const auth = request.headers.get("authorization") ?? "";
  return auth === `Bearer ${secret}`;
}

export async function GET(request: Request): Promise<Response> {
  if (!authorizedCron(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const summary = await runHistoryStep(3);
  return NextResponse.json(summary);
}
