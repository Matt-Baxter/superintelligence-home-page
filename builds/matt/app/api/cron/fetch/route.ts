import { fetchAll } from "@/lib/ingest";

// Scheduled endpoint: Vercel Cron calls this once a day (vercel.json). (REQ-001)
// Only callers holding CRON_SECRET may run it.

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Not authorized." }, { status: 401 });
  }
  try {
    return Response.json(await fetchAll());
  } catch (err) {
    console.error("Fetch run failed:", err);
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
