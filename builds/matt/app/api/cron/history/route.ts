import { runHistory } from "@/lib/history";
import { judgePending } from "@/lib/judge";

// History fill (Build A research §16). Each call reads more of the sources' archives back to
// 2023, then has the AI judge score what was found. Safe to call repeatedly: progress is saved,
// and once everything is read it only judges leftovers. Runs nightly (vercel.json) and can be
// run by hand to finish sooner. Only callers holding CRON_SECRET may run it.

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const FETCH_SECONDS = 150;
const TOTAL_SECONDS = 270;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Not authorized." }, { status: 401 });
  }
  const started = Date.now();
  try {
    const history = await runHistory(started + FETCH_SECONDS * 1000);
    const judge = await judgePending(started + TOTAL_SECONDS * 1000);
    return Response.json({ history, judge, finished: history.tasksRemaining === 0 && judge.remaining === 0 });
  } catch (err) {
    console.error("History run failed:", err);
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
