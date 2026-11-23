import { NextResponse } from "next/server";
import { getWeeklyBrief } from "@/lib/stories";

export async function GET(): Promise<Response> {
  const brief = await getWeeklyBrief(14);
  return NextResponse.json(brief, {
    headers: {
      "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
    },
  });
}
