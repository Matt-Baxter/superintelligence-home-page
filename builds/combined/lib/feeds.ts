import { XMLParser } from "fast-xml-parser";

// Fault-isolated RSS 2.0 / Atom 1.0 / RDF feed parser (REQ-001, REQ-008).

export type ParsedFeedItem = {
  title: string;
  link: string;
  summary: string;
  authors: string;
  published: Date | null;
  outlet: string | null;
  outletUrl: string | null;
};

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  trimValues: true,
  parseTagValue: false,
});

function asArray<T>(val: T | T[] | undefined | null): T[] {
  if (val === undefined || val === null) return [];
  return Array.isArray(val) ? val : [val];
}

function readText(node: unknown): string {
  if (node === null || node === undefined) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(readText).filter(Boolean).join(" ");
  if (typeof node === "object") {
    const rec = node as Record<string, unknown>;
    if ("#text" in rec) return readText(rec["#text"]);
    if ("__cdata" in rec) return readText(rec["__cdata"]);
  }
  return "";
}

function parseDate(raw: unknown): Date | null {
  const s = readText(raw).trim();
  if (!s) return null;
  const ms = Date.parse(s);
  if (!Number.isFinite(ms)) return null;
  const d = new Date(ms);
  // Guard against wildly malformed future dates (> 3 days in future)
  if (d.getTime() > Date.now() + 3 * 86_400_000) return new Date();
  return d;
}

function extractAtomLink(linksRaw: unknown): string {
  const links = asArray(linksRaw);
  for (const l of links) {
    if (typeof l === "string") return l;
    if (l && typeof l === "object") {
      const rec = l as Record<string, unknown>;
      const rel = String(rec["@_rel"] ?? "alternate");
      const href = String(rec["@_href"] ?? "");
      if (href && (rel === "alternate" || !rec["@_rel"])) return href;
    }
  }
  const first = links[0];
  if (first && typeof first === "object" && "@_href" in (first as Record<string, unknown>)) {
    return String((first as Record<string, unknown>)["@_href"] ?? "");
  }
  return "";
}

function extractAuthors(raw: unknown): string {
  const list = asArray(raw);
  const names = list
    .map((entry) => {
      if (typeof entry === "string") return entry;
      if (entry && typeof entry === "object") {
        const rec = entry as Record<string, unknown>;
        return readText(rec.name ?? rec["#text"] ?? "");
      }
      return "";
    })
    .map((s) => s.trim())
    .filter(Boolean);
  return names.slice(0, 8).join(", ");
}

export function parseFeedXml(xml: string, maxItems = 40): ParsedFeedItem[] {
  if (!xml || !xml.trim()) return [];
  const doc = xmlParser.parse(xml) as Record<string, unknown>;

  // RSS 2.0 / RDF
  const channel =
    (doc.rss as Record<string, unknown> | undefined)?.channel ??
    (doc["rdf:RDF"] as Record<string, unknown> | undefined);

  if (channel && typeof channel === "object") {
    const rawItems = asArray((channel as Record<string, unknown>).item);
    return rawItems.slice(0, maxItems).map((raw) => {
      const item = raw as Record<string, unknown>;
      let title = readText(item.title);
      const link = readText(item.link) || extractAtomLink(item.link) || readText(item.guid);
      const summary = readText(item.description ?? item["content:encoded"] ?? item.summary);
      const authors = extractAuthors(item.author ?? item["dc:creator"]);
      const published = parseDate(item.pubDate ?? item["dc:date"] ?? item.published);

      // Google News RSS <source url="https://...">Outlet Name</source>
      let outlet: string | null = null;
      let outletUrl: string | null = null;
      if (item.source && typeof item.source === "object") {
        const srcObj = item.source as Record<string, unknown>;
        outlet = readText(srcObj["#text"]).trim() || null;
        outletUrl = String(srcObj["@_url"] ?? "").trim() || null;
        if (outlet && title.endsWith(` - ${outlet}`)) {
          title = title.slice(0, -(` - ${outlet}`).length).trim();
        }
      }

      return { title, link, summary, authors, published, outlet, outletUrl };
    });
  }

  // Atom 1.0
  const atomFeed = doc.feed as Record<string, unknown> | undefined;
  if (atomFeed && typeof atomFeed === "object") {
    const entries = asArray(atomFeed.entry);
    return entries.slice(0, maxItems).map((raw) => {
      const entry = raw as Record<string, unknown>;
      const title = readText(entry.title);
      const link = extractAtomLink(entry.link) || readText(entry.id);
      const summary = readText(entry.summary ?? entry.content);
      const authors = extractAuthors(entry.author);
      const published = parseDate(entry.published ?? entry.updated);
      return { title, link, summary, authors, published, outlet: null, outletUrl: null };
    });
  }

  return [];
}

export async function fetchTextWithTimeout(
  url: string,
  init?: RequestInit & { timeoutMs?: number },
  timeoutMs = 12_000,
): Promise<string> {
  const { timeoutMs: optTimeout, ...restInit } = init ?? {};
  const res = await fetch(url, {
    ...restInit,
    headers: {
      "user-agent": "SuperintelligenceHomepage/1.0 (+https://superintelligence-home-page.vercel.app)",
      accept: "application/atom+xml, application/rss+xml, application/xml, text/xml, application/json, */*",
      ...(restInit.headers ?? {}),
    },
    signal: AbortSignal.timeout(optTimeout ?? timeoutMs),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} from ${new URL(url).hostname}`);
  }
  return res.text();
}

export async function fetchFeed(url: string, maxItems = 35): Promise<ParsedFeedItem[]> {
  const body = await fetchTextWithTimeout(url);
  return parseFeedXml(body, maxItems);
}
