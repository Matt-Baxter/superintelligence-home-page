// Plain-text sanitization, Twitter/X blocking, and canonical identity keys (REQ-004, REQ-006, REQ-007, REQ-021).

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  hellip: "…",
};

export function decodeEntities(input: string): string {
  return input.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (full, body: string) => {
    if (body.startsWith("#x") || body.startsWith("#X")) {
      const code = Number.parseInt(body.slice(2), 16);
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : full;
    }
    if (body.startsWith("#")) {
      const code = Number.parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : full;
    }
    return ENTITIES[body.toLowerCase()] ?? full;
  });
}

// Strips <script>, <style>, comments, and all HTML tags so untrusted feed markup never executes (AT-15).
export function htmlToText(raw: string | null | undefined): string {
  if (!raw) return "";
  const withoutScripts = String(raw)
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|iframe|object|embed)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ");
  return decodeEntities(withoutScripts).replace(/\s+/g, " ").trim();
}

export function truncate(text: string, maxChars = 300): string {
  const chars = Array.from(text);
  if (chars.length <= maxChars) return text;
  const sliced = chars.slice(0, maxChars - 1).join("").replace(/\s+\S*$/, "");
  return `${sliced || chars.slice(0, maxChars - 1).join("")}…`;
}

const TWITTER_HOST_RE = /(^|\.)((twitter|x)\.com|t\.co|nitter\.[a-z0-9.-]+)$/i;

export function isTwitterUrl(raw: string | null | undefined): boolean {
  if (!raw) return false;
  try {
    const parsed = new URL(raw.trim());
    return TWITTER_HOST_RE.test(parsed.hostname);
  } catch {
    return /(?:https?:\/\/)?(?:www\.|mobile\.)?(?:twitter\.com|x\.com|t\.co|nitter\.)/i.test(raw);
  }
}

// Extracts canonical arXiv base identifier (strips v1/v2 version suffix) so v1 & v2 group together.
export function arxivId(urlOrText: string | null | undefined): string | null {
  if (!urlOrText) return null;
  const m = urlOrText.match(/(?:arxiv\.org\/(?:abs|pdf|html)\/|arxiv:\s*)(\d{4}\.\d{4,5}|[a-z-]+\/\d{7})(?:v\d+)?/i);
  return m ? m[1].toLowerCase() : null;
}

export function doiId(urlOrText: string | null | undefined): string | null {
  if (!urlOrText) return null;
  const m = urlOrText.match(/\b(10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+)\b/);
  return m ? m[1].replace(/[.,;)]+$/, "").toLowerCase() : null;
}

const TRACKING_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "ref",
  "source",
  "fbclid",
  "gclid",
  "mc_cid",
  "mc_eid",
]);

export function normalizeUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    u.hash = "";
    u.hostname = u.hostname.toLowerCase().replace(/^www\./, "");
    for (const key of [...u.searchParams.keys()]) {
      if (TRACKING_PARAMS.has(key.toLowerCase())) u.searchParams.delete(key);
    }
    u.searchParams.sort();
    const pathname = u.pathname.replace(/\/+$/, "") || "/";
    const search = u.searchParams.toString();
    return `${u.hostname}${pathname}${search ? `?${search}` : ""}`;
  } catch {
    return null;
  }
}

const STOP_PREFIXES = /^(?:arxiv\s*\d{4}\.\d{4,5}\s*:?\s*|new\s+paper\s*:\s*|paper\s*:\s*|post\s*:\s*)/i;

export function normalizeTitle(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = htmlToText(raw)
    .replace(STOP_PREFIXES, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  // Require at least 12 characters and 3 words so generic titles like "Weekly Update" never over-merge.
  if (cleaned.length < 12 || cleaned.split(" ").length < 3) return null;
  return cleaned;
}

export function storyKeysFor(opts: { url: string; title: string; summary?: string }): string[] {
  const keys: string[] = [];
  const combined = `${opts.url} ${opts.title} ${opts.summary ?? ""}`;
  const ax = arxivId(combined);
  if (ax) keys.push(`arxiv:${ax}`);
  const doi = doiId(combined);
  if (doi) keys.push(`doi:${doi}`);
  const normUrl = normalizeUrl(opts.url);
  if (normUrl) keys.push(`url:${normUrl}`);
  const normTitle = normalizeTitle(opts.title);
  if (normTitle) keys.push(`title:${normTitle}`);
  return [...new Set(keys)];
}

// Extracts public code/model/dataset repository links from abstracts (REQ-047; never Twitter/X).
export function extractCodeUrls(text: string | null | undefined): string[] {
  if (!text) return [];
  const matches = text.match(/https?:\/\/(?:github\.com|gitlab\.com|huggingface\.co)\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+/gi) ?? [];
  const clean = matches
    .map((u) => u.replace(/[.,;)\]]+$/, ""))
    .filter((u) => !isTwitterUrl(u));
  return [...new Set(clean)].slice(0, 4);
}

// Cleans scraped Table-of-Contents / navigation chrome (e.g. "Contents Overview 1 Background 2 Methodology...")
// for clean editorial card presentation while keeping underlying stored text untouched.
export function cleanDisplaySummary(raw: string | null | undefined): {
  text: string;
  wasTocBoilerplate: boolean;
} {
  if (!raw) return { text: "", wasTocBoilerplate: false };
  const s = raw.trim();
  if (!s) return { text: "", wasTocBoilerplate: false };

  // Detect scraped TOC sequences like "Contents Overview 1 Background 2 Methodology 3 Results..."
  const tocNumberedSections = (s.match(/\b\d+\s+[A-Z][A-Za-z-]{2,}/g) ?? []).length;
  const startsWithToc = /^(?:table\s+of\s+contents|contents)\b/i.test(s);
  if ((startsWithToc && tocNumberedSections >= 2) || tocNumberedSections >= 4) {
    // Extract readable section names as a structured outline instead of raw concatenated TOC soup
    const stripped = s
      .replace(/^(?:table\s+of\s+contents|contents)\s*/i, "")
      .replace(/\bAppendices\b[\s\S]*$/i, "")
      .trim();
    const parts = stripped
      .split(/\s+(?=\d+(?:\.\d+)?\s+[A-Z]|[A-Z]\s+[A-Z][a-z])/)
      .map((p) => p.replace(/^\d+(?:\.\d+)?\s+/, "").trim())
      .filter((p) => p.length > 2 && p.length < 48);
    if (parts.length >= 3) {
      return {
        text: `Structured technical report covering: ${parts.slice(0, 5).join(" · ")}.`,
        wasTocBoilerplate: true,
      };
    }
    return { text: "", wasTocBoilerplate: true };
  }

  // Strip arXiv prefix boilerplate such as "arXiv:2503.12345v1 Announce Type: new Abstract: "
  const cleaned = s
    .replace(/^arXiv:\S+\s+Announce Type:\s*\w+\s*Abstract:\s*/i, "")
    .replace(/^Abstract[:\s—-]+/i, "")
    .trim();

  return { text: cleaned, wasTocBoilerplate: false };
}

export function domainOf(rawUrl: string | null | undefined): string {
  if (!rawUrl) return "";
  try {
    return new URL(rawUrl).hostname.replace(/^www\./i, "");
  } catch {
    return "";
  }
}

const shortUtcDate = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

export function formatRelativeTime(publishedAt: Date, nowMs = Date.now()): string {
  const diffMs = nowMs - publishedAt.getTime();
  if (!Number.isFinite(diffMs) || diffMs < 0) {
    return shortUtcDate.format(publishedAt);
  }
  const hours = Math.floor(diffMs / 3_600_000);
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 14) return `${days}d ago`;
  return shortUtcDate.format(publishedAt);
}
