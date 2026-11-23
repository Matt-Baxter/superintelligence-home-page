import { buildAtomFeedXml } from "@/lib/stories";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const topic = url.searchParams.get("topic") ?? "";
  const xml = await buildAtomFeedXml(url.origin, topic);

  return new Response(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/atom+xml; charset=utf-8",
      "Cache-Control": "public, max-age=900, stale-while-revalidate=1800",
    },
  });
}
