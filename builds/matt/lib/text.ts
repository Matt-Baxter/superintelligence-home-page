// Text helpers for ingesting feed items. (REQ-004, REQ-006, REQ-007, REQ-021)

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (whole, code: string) => {
    if (code[0] === "#") {
      const n = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : "";
    }
    return NAMED_ENTITIES[code.toLowerCase()] ?? whole;
  });
}

// Turns feed HTML into plain text: drops script and style blocks entirely, removes every tag,
// decodes entities, and collapses whitespace. The result is only ever rendered as text, so
// nothing from a feed can run or load in a reader's browser. (REQ-021)
export function htmlToText(html: string): string {
  const withoutBlocks = html
    .replace(/<(script|style|iframe|object|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
  const withoutTags = withoutBlocks.replace(/<[^>]*>/g, " ");
  // Decode after removing tags, then remove any tags the decoding revealed (e.g. &lt;script&gt;).
  const decoded = decodeEntities(withoutTags).replace(/<[^>]*>/g, " ");
  return decoded.replace(/\s+/g, " ").trim();
}

// Cuts text to at most max characters, ending with "…" when shortened. (REQ-007)
export function truncate(text: string, max = 300): string {
  const chars = Array.from(text);
  if (chars.length <= max) return text;
  return chars.slice(0, max - 1).join("").trimEnd() + "…";
}

const TRACKING_PARAMS = /^(utm_.*|fbclid|gclid|mc_cid|mc_eid|ref|ref_src|source)$/i;

// Normalizes a URL so the same article from different feeds produces the same key. (REQ-004)
export function normalizeUrl(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  const host = u.hostname.toLowerCase().replace(/^www\./, "");
  const params = [...u.searchParams.entries()]
    .filter(([k]) => !TRACKING_PARAMS.test(k))
    .sort(([a], [b]) => a.localeCompare(b));
  const query = params.length ? "?" + new URLSearchParams(params).toString() : "";
  const path = u.pathname.replace(/\/+$/, "");
  return `${host}${path}${query}`;
}

// Normalizes a title: lowercase, punctuation removed, spaces collapsed. (REQ-004)
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Finds an arXiv ID in an abs/pdf/html link, without the version suffix, e.g. "2411.01234".
// (REQ-004)
export function arxivId(raw: string): string | null {
  const m = raw.match(/arxiv\.org\/(?:abs|pdf|html)\/(\d{4}\.\d{4,5})(?:v\d+)?/i);
  return m ? m[1] : null;
}

const TWITTER_HOSTS = ["twitter.com", "x.com", "t.co"];

// True if the link goes to Twitter/X, including subdomains like mobile.twitter.com. (REQ-006)
export function isTwitterUrl(raw: string): boolean {
  let host: string;
  try {
    host = new URL(raw.trim()).hostname.toLowerCase();
  } catch {
    return false;
  }
  return TWITTER_HOSTS.some((h) => host === h || host.endsWith("." + h));
}
