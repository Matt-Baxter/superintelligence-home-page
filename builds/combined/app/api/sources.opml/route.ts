import { buildSourcesOpmlXml } from "@/lib/stories";

export async function GET(): Promise<Response> {
  const xml = await buildSourcesOpmlXml();
  return new Response(xml, {
    status: 200,
    headers: {
      "Content-Type": "text/x-opml; charset=utf-8",
      "Content-Disposition": 'attachment; filename="superintelligence-sources.opml"',
      "Cache-Control": "public, max-age=3600",
    },
  });
}
