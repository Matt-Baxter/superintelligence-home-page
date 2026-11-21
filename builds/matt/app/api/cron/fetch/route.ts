import { fetchAll } from "@/lib/ingest";
import { judgePending } from "@/lib/judge";

// Scheduled endpoint: Vercel Cron calls this once a day (vercel.json). (REQ-001)
// Fetches every source, then has the AI judge score new stories (Build A plan, research §14).
// Only callers holding CRON_SECRET may run it.

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Not authorized." }, { status: 401 });
  }
  try {
    const fetched = await fetchAll();
    const judge = await judgePending();
    return Response.json({ ...fetched, judge });
  } catch (err) {
    console.error("Fetch run failed:", err);
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
