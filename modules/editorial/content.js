// Content generation and channel versions for the Editorial CMS (REQ-055, proposed). Pure functions, no model calls:
// drafts are written by rules from the site's own stories (titles, links, scores and their explanations), so every
// line can be checked against a record. Authors are never named and no claim is put in anyone's mouth; headlines are
// quoted as headlines. A generated draft is only a draft: a person edits it and publishes it (REQ-054 delivers it).
const MAX_BODY = 20000;
const DAY = 864e5;
const clip = (s, n) => { const a = [...String(s || "").replace(/\s+/g, " ").trim()]; return a.length <= n ? a.join("") : a.slice(0, Math.max(0, n - 1)).join("").replace(/\s+\S*$/, "") + "…"; };
const firstSentence = (s) => clip((String(s || "").replace(/\(Synthetic test record\.\)/g, "").match(/^.*?[.!?](\s|$)/) || [s || ""])[0], 220);
const day = (d) => new Date(d).toISOString().slice(0, 10);
const when = (s) => s.published_at || s.first_seen || "";
const sourcesLine = (s) => { const names = [...new Set((s.sources || []).map((x) => x.name))]; return names.length ? `Covered by ${names.length} source${names.length > 1 ? "s" : ""}: ${names.slice(0, 4).join(", ")}${names.length > 4 ? ", and more" : ""}.` : ""; };
const scoreLine = (s) => `Significance ${s.significance || 0}/100${s.analysis?.type?.label ? `, ${s.analysis.type.label.toLowerCase()}` : ""}${s.analysis?.evidence?.label ? `, evidence: ${s.analysis.evidence.label.toLowerCase()}` : ""}.`;
const footer = (now) => `This draft was generated on ${day(now)} from the stories and scores on this site. Check every line against its link before publishing, and rewrite it in your own words.`;
const fit = (body) => (body.length <= MAX_BODY ? body : body.slice(0, MAX_BODY - 40).replace(/\n[^\n]*$/, "") + "\n\n(Shortened to fit the post limit.)");

const KINDS = {
  "weekly-digest": { label: "Weekly digest", about: "The most significant stories of the last 7 days, with why each one scored." },
  "topic-roundup": { label: "Topic round-up", about: "What happened in one topic over the last 30 days, newest first.", needs: "topic" },
  "story-explainer": { label: "Story explainer", about: "One story in plain words: what it is, why it is on the feed, what to check.", needs: "story" },
};

function weeklyDigest(stories, { now = Date.now(), limit = 8 } = {}) {
  const since = now - 7 * DAY;
  const pick = stories.filter((s) => Date.parse(when(s)) >= since).sort((a, b) => (b.significance || 0) - (a.significance || 0) || b.id - a.id).slice(0, limit);
  if (!pick.length) throw new Error("No stories in the last 7 days to write a digest from.");
  const topics = [...new Set(pick.flatMap((s) => (s.topics || []).filter((t) => !t.via).map((t) => t.label)))];
  const body = [
    `The ${pick.length} most significant superintelligence stories from ${day(since)} to ${day(now)}, by the site's significance score. Topics this week: ${topics.slice(0, 6).join(", ") || "none tagged"}.`,
    ...pick.map((s, i) => [`${i + 1}. ${s.title}`, firstSentence(s.summary), `${scoreLine(s)} ${sourcesLine(s)}`, `Read it: ${s.url}`].filter(Boolean).join("\n")),
    "How these were picked: the score adds points for the evidence level, how many sources covered the story, the kind of update, benchmark results and frontier signals. Each story's page shows every point.",
    footer(now),
  ].join("\n\n");
  return { title: `Weekly digest: ${day(since)} to ${day(now)}`, summary: clip(`The week's ${pick.length} most significant stories${topics.length ? `, across ${topics.slice(0, 3).join(", ")}` : ""}.`, 300), body: fit(body), sources: pick.map((s) => ({ id: s.id, title: s.title, url: s.url })) };
}

function topicRoundup(stories, { topic, topicLabel, now = Date.now(), limit = 10 } = {}) {
  if (!topic) throw new Error("Choose a topic for the round-up.");
  const since = now - 30 * DAY, label = topicLabel || topic;
  const pick = stories.filter((s) => (s.topics || []).some((t) => t.id === topic) && Date.parse(when(s)) >= since).sort((a, b) => String(when(b)).localeCompare(String(when(a))) || b.id - a.id).slice(0, limit);
  if (!pick.length) throw new Error(`No ${label} stories in the last 30 days.`);
  const top = [...pick].sort((a, b) => (b.significance || 0) - (a.significance || 0))[0];
  const body = [
    `${pick.length} ${label} stor${pick.length > 1 ? "ies" : "y"} from the last 30 days, newest first. The highest-scoring one was "${top.title}" at ${top.significance || 0}/100.`,
    ...pick.map((s) => [`${day(when(s))}: ${s.title}`, firstSentence(s.summary), `${scoreLine(s)} ${sourcesLine(s)}`, `Read it: ${s.url}`].filter(Boolean).join("\n")),
    `Why a story counts as ${label}: its title or summary matched the topic's terms; each story page lists the words that matched.`,
    footer(now),
  ].join("\n\n");
  return { title: `${label}: the last 30 days`, summary: clip(`${pick.length} ${label} stories from the last 30 days, with how each one scored.`, 300), body: fit(body), sources: pick.map((s) => ({ id: s.id, title: s.title, url: s.url })) };
}

function storyExplainer(story, { now = Date.now() } = {}) {
  if (!story) throw new Error("That story isn't on the feed.");
  const a = story.analysis || {}, why = (a.why || []).filter((w) => w.points);
  const tags = (story.topics || []).filter((t) => !t.via).map((t) => `${t.label} (matched ${t.matched?.length ? t.matched.map((m) => `"${m}"`).join(", ") : "a parent topic"})`);
  const body = [
    `What it is: "${story.title}". ${firstSentence(story.summary)}`,
    `Why it is on this feed: ${a.scope?.reason || "it matched the site's superintelligence topics"}. Tagged ${tags.join("; ") || "with no topic"}.`,
    `How it scored: ${story.significance || 0}/100.${why.length ? " " + why.map((w) => `${w.factor} +${w.points} (${w.detail})`).join("; ") + "." : ""}`,
    sourcesLine(story) || "Covered by one source.",
    `What to check before sharing: the evidence level is ${(a.evidence?.label || "unknown").toLowerCase()}${a.claims?.length ? `, and it makes ${a.claims.length} frontier claim${a.claims.length > 1 ? "s" : ""} (${a.claims.join("; ")}) that need their own evidence` : ""}. Read the original before repeating any number.`,
    `Original: ${story.url}`,
    footer(now),
  ].join("\n\n");
  return { title: `Explained: ${clip(story.title, 140)}`, summary: clip(`What "${story.title}" is, why it is on the feed and what to check before sharing it.`, 300), body: fit(body), sources: [{ id: story.id, title: story.title, url: story.url }] };
}

// Channel versions of one post. Social networks: no Twitter/X (refused on purpose). Lengths are in characters
// (code points), each network's own post limit; the link always fits.
const NETWORKS = [{ id: "bluesky", label: "Bluesky", limit: 300 }, { id: "threads", label: "Threads", limit: 500 }, { id: "mastodon", label: "Mastodon", limit: 500 }, { id: "linkedin", label: "LinkedIn", limit: 3000 }];
function channels(post, url) {
  const title = String(post.title || "").trim(), summary = String(post.summary || "").trim(), body = String(post.body || "").trim();
  const paragraphs = body.split(/\n\s*\n/).filter(Boolean);
  const social = NETWORKS.map((n) => {
    const room = n.limit - [...url].length - 2;
    // A summary that already carries the title's words stands alone, so a short post doesn't say the title twice.
    const words = (t) => new Set(t.toLowerCase().match(/[a-z0-9]{4,}/g) || []), tw = words(title), sw = words(summary);
    const lead = tw.size && [...tw].filter((x) => sw.has(x)).length / tw.size >= 0.6 ? summary : `${title}: ${summary}`;
    const long = n.limit >= 1000 ? `${title}\n\n${summary}\n\n${clip(paragraphs.slice(0, 2).join("\n\n"), room - title.length - summary.length - 4)}` : lead;
    const text = `${clip(long, room)}\n\n${url}`;
    return { network: n.id, label: n.label, limit: n.limit, length: [...text].length, text };
  });
  return {
    blog: { title, text: `# ${title}\n\n_${summary}_\n\n${paragraphs.join("\n\n")}\n\nPermanent link: ${url}\n` },
    newsletter: { subject: clip(title, 78), preheader: clip(summary, 110), text: `${title}\n${"=".repeat(Math.min(60, [...title].length))}\n\n${summary}\n\n${paragraphs.join("\n\n")}\n\nRead it on the site: ${url}\n` },
    social,
    note: "Drafts for a person to post. Nothing is posted automatically, and there is no Twitter/X version.",
  };
}

// Delivery formats for published posts (REQ-054).
const xml = (s) => String(s ?? "").replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]);
function rss(posts, base) {
  const items = posts.map((p) => `<item><title>${xml(p.title)}</title><link>${xml(`${base}/m/journal?slug=${encodeURIComponent(p.slug)}`)}</link><guid isPermaLink="false">si-journal-${p.id}</guid>${p.published_at ? `<pubDate>${new Date(p.published_at).toUTCString()}</pubDate>` : ""}<description>${xml(p.summary)}</description></item>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Superintelligence Homepage: Journal</title><link>${xml(base)}/m/journal</link><description>Original editorial posts. Commentary, separate from the research feed and its scores.</description>${items}</channel></rss>`;
}
function jsonFeed(posts, base) {
  return { version: "https://jsonfeed.org/version/1.1", title: "Superintelligence Homepage: Journal", home_page_url: `${base}/m/journal`, feed_url: `${base}/api/editorial/feed.json`,
    items: posts.map((p) => ({ id: `si-journal-${p.id}`, url: `${base}/m/journal?slug=${encodeURIComponent(p.slug)}`, title: p.title, summary: p.summary, ...(p.body !== undefined ? { content_text: p.body } : {}), ...(p.published_at ? { date_published: p.published_at } : {}) })) };
}

module.exports = { KINDS, NETWORKS, weeklyDigest, topicRoundup, storyExplainer, channels, rss, jsonFeed, clip };
