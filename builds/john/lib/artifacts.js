// REQ-047 / T040: code, model and dataset links found in a story's title, summary or URL, kept as `artifact` entities.
// Deterministic and free: a fixed list of hosts and path shapes, no model call. Twitter/X is refused (REQ-006).
//   artifacts.extract({ url, title, summary }) -> [{ kind: "code"|"model"|"dataset"|"demo", url, id }]
const SOCIAL = /^https?:\/\/([^/]*\.)?(twitter\.com|x\.com|nitter\.[^/]+)(\/|$)/i;
const URL_RE = /https?:\/\/[^\s<>"'()\]]+/gi;
const MAX = 8;

// Each rule maps a URL to a canonical id; the first rule that matches wins.
const RULES = [
  { kind: "dataset", re: /^https?:\/\/(?:www\.)?huggingface\.co\/datasets\/([\w.-]+\/[\w.-]+)/i, id: (m) => `hf-dataset:${m[1]}` },
  { kind: "demo", re: /^https?:\/\/(?:www\.)?huggingface\.co\/spaces\/([\w.-]+\/[\w.-]+)/i, id: (m) => `hf-space:${m[1]}` },
  { kind: "model", re: /^https?:\/\/(?:www\.)?huggingface\.co\/(?!datasets\/|spaces\/|papers\/|blog\/|docs\/|collections\/)([\w.-]+\/[\w.-]+)/i, id: (m) => `hf-model:${m[1]}` },
  { kind: "code", re: /^https?:\/\/(?:www\.)?github\.com\/([\w.-]+\/[\w.-]+)/i, id: (m) => `github:${m[1].replace(/\.git$/i, "")}` },
  { kind: "code", re: /^https?:\/\/(?:www\.)?gitlab\.com\/([\w.-]+\/[\w.-]+)/i, id: (m) => `gitlab:${m[1].replace(/\.git$/i, "")}` },
  { kind: "dataset", re: /^https?:\/\/(?:www\.)?kaggle\.com\/datasets\/([\w.-]+\/[\w.-]+)/i, id: (m) => `kaggle:${m[1]}` },
];
// GitHub paths that are site pages, not repositories.
const GITHUB_RESERVED = new Set(["orgs", "topics", "features", "marketplace", "sponsors", "settings", "about", "pricing", "login", "explore"]);

function classify(raw) {
  const url = String(raw).replace(/[.,;:!?]+$/, "");
  if (SOCIAL.test(url)) return null;
  for (const r of RULES) {
    const m = url.match(r.re);
    if (!m) continue;
    if (r.id(m).startsWith("github:") && GITHUB_RESERVED.has(m[1].split("/")[0].toLowerCase())) return null;
    const id = r.id(m).toLowerCase();
    return { kind: r.kind, id, url: url.split(/[?#]/)[0] };
  }
  return null;
}

function extract({ url = "", title = "", summary = "" } = {}) {
  const found = new Map();
  for (const raw of [url, ...`${title}\n${summary}`.slice(0, 8000).matchAll(URL_RE)].map((x) => (Array.isArray(x) ? x[0] : x))) {
    if (!raw || found.size >= MAX) continue;
    const a = classify(raw);
    if (a && !found.has(a.id)) found.set(a.id, a);
  }
  return [...found.values()];
}

module.exports = { extract, classify, KINDS: ["code", "model", "dataset", "demo"] };
