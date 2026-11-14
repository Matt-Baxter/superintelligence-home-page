import { XMLParser } from "fast-xml-parser";

// Fetches and parses one RSS 2.0, RSS 1.0 (RDF) or Atom feed. (REQ-001, REQ-008)

export type FeedItem = {
  title: string;
  link: string;
  summary: string;
  published: Date | null;
};

const TIMEOUT_MS = 10_000;
// Only the newest items from each source are read, so one very long feed can't slow the fetch.
export const MAX_ITEMS_PER_SOURCE = 50;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  processEntities: true,
  htmlEntities: true,
});

function asArray<T>(v: T | T[] | undefined | null): T[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

// Feed fields can be plain strings or objects like { "#text": "...", "@_type": "html" }.
function text(v: unknown): string {
  if (v === undefined || v === null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return text(v[0]);
  if (typeof v === "object" && "#text" in (v as Record<string, unknown>)) {
    return text((v as Record<string, unknown>)["#text"]);
  }
  return "";
}

function date(v: unknown): Date | null {
  const s = text(v).trim();
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

type Raw = Record<string, unknown>;

function atomLink(entry: Raw): string {
  const links = asArray(entry.link as Raw | Raw[]);
  const alternate = links.find((l) => typeof l === "object" && (!l["@_rel"] || l["@_rel"] === "alternate"));
  const chosen = alternate ?? links[0];
  if (!chosen) return text(entry.id);
  return typeof chosen === "string" ? chosen : text(chosen["@_href"]);
}

export function parseFeed(xml: string): FeedItem[] {
  const doc = parser.parse(xml) as Raw;

  const rss = doc.rss as Raw | undefined;
  const rdf = doc["rdf:RDF"] as Raw | undefined;
  const atom = doc.feed as Raw | undefined;

  let items: FeedItem[] = [];
  if (rss || rdf) {
    const channel = (rss?.channel ?? {}) as Raw;
    const rawItems = asArray((rss ? channel.item : rdf?.item) as Raw | Raw[]);
    items = rawItems.map((i) => ({
      title: text(i.title),
      link: text(i.link) || text(i.guid),
      summary: text(i.description) || text(i["content:encoded"]),
      published: date(i.pubDate) ?? date(i["dc:date"]),
    }));
  } else if (atom) {
    items = asArray(atom.entry as Raw | Raw[]).map((e) => ({
      title: text(e.title),
      link: atomLink(e),
      summary: text(e.summary) || text(e.content),
      published: date(e.published) ?? date(e.updated),
    }));
  } else {
    throw new Error("Not an RSS or Atom feed");
  }

  return items
    .filter((i) => i.title && i.link)
    .sort((a, b) => (b.published?.getTime() ?? 0) - (a.published?.getTime() ?? 0))
    .slice(0, MAX_ITEMS_PER_SOURCE);
}

export async function fetchFeed(url: string): Promise<FeedItem[]> {
  let res: Response;
  try {
    res = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "User-Agent": "SuperintelligenceHomepage/1.0 (class project feed reader)" },
      cache: "no-store",
    });
  } catch (err) {
    const timedOut = err instanceof Error && err.name === "TimeoutError";
    throw new Error(timedOut ? "Timed out after 10 seconds" : "Could not connect");
  }
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return parseFeed(await res.text());
}
