// Shared helpers for every page: API calls, auth guard, top bar, small DOM utilities.
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const params = new URLSearchParams(location.search);

async function api(path, opts = {}) {
  const res = await fetch(path, {
    method: opts.method || (opts.body ? "POST" : "GET"),
    headers: opts.body ? { "Content-Type": "application/json" } : {},
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    credentials: "same-origin",
  });
  let data = {}; try { data = await res.json(); } catch (e) {}
  if (res.status === 401 && !opts.allow401) { location.href = "/?next=" + encodeURIComponent(location.pathname + location.search); throw new Error("Please sign in."); }
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status}).`);
  return data;
}

const NAV = [["/", "Feed"], ["/brief", "Weekly brief"], ["/lists", "Reading lists"], ["/sources", "Sources"], ["/agent-log", "Agent log"]];
async function requireUser() {
  const { user } = await api("/api/me", { allow401: true });
  if (!user) { location.href = "/?next=" + encodeURIComponent(location.pathname + location.search); throw new Error("Not signed in"); }
  topbar(user); return user;
}
function topbar(user) {
  const here = location.pathname.replace(/\.html$/, "").replace(/\/index$/, "/") || "/";
  const bar = document.createElement("header"); bar.className = "topbar";
  const links = user?.admin ? [...NAV, ["/project", "Project"], ["/admin", "Admin"]] : NAV;
  bar.innerHTML = `<div class="in"><a class="brand" href="/">Superintelligence Homepage</a><nav class="nav">${links.map(([h, t]) => `<a href="${h}"${(h === "/" ? here === "/" : here.startsWith(h)) ? ' aria-current="page"' : ""}>${t}</a>`).join("")}</nav>
    <div class="who">${user ? `<span>${esc(user.name)}</span><button class="btn" id="logout" type="button">Sign out</button>` : ""}</div></div>`;
  document.body.prepend(bar);
  const lo = $("#logout"); if (lo) lo.onclick = async () => { await api("/api/logout", { method: "POST" }); location.href = "/"; };
}
function showErr(el, e) { el.textContent = e?.message || String(e); el.className = "err"; }
function flash(el, msg) { el.textContent = msg; el.className = "ok"; setTimeout(() => { if (el.textContent === msg) el.textContent = ""; }, 2500); }
async function copy(text, btn) {
  try { await navigator.clipboard.writeText(text); if (btn) { const t = btn.textContent; btn.textContent = "Copied"; setTimeout(() => (btn.textContent = t), 1200); } } catch (e) {}
}
// Actions that json-render specs are allowed to trigger (see views/catalog.mjs).
const jrHandlers = (extra = {}) => ({
  openStory: ({ id }) => { location.href = `/story?id=${id}`; },
  filterTopic: ({ topic }) => { location.href = `/?topic=${encodeURIComponent(topic)}`; },
  copyText: ({ text }) => copy(text),
  navigate: ({ href }) => { if (href.startsWith("/")) location.href = href; },
  ...extra,
});
const ago = (iso) => { if (!iso) return ""; const t = Date.parse(iso.includes("T") ? iso : iso.replace(" ", "T") + "Z"); const h = (Date.now() - t) / 36e5;
  return h < 1 ? "just now" : h < 24 ? `${Math.round(h)}h ago` : h < 24 * 14 ? `${Math.round(h / 24)}d ago` : new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric" }); };
const KIND = { papers: "Paper", lab: "Lab", "research-org": "Research org", forum: "Forum", newsletter: "Newsletter", academic: "Academic", community: "Community", news: "News", policy: "Policy", submitted: "Reader-submitted" };
// One story card, used by the feed, lists and saved views.
function storyCard(s, opts = {}) {
  const li = document.createElement("li"); li.className = "story"; li.dataset.id = s.id;
  const tags = s.topics.filter((t) => !t.via).slice(0, 4).map((t) => `<a class="tag" href="/?topic=${t.id}" title="${t.matched.length ? "Matched: " + esc(t.matched.join(", ")) : ""}">${esc(t.label)}</a>`).join("");
  const orgs = s.orgs.slice(0, 2).map((o) => `<a class="tag org" href="/?org=${o.id}">${esc(o.label)}</a>`).join("");
  const kinds = [...new Set(s.sources.map((x) => KIND[x.kind] || x.kind))];
  li.innerHTML = `<button class="vote ${s.voted ? "on" : ""}" type="button" aria-pressed="${s.voted}" aria-label="Upvote"><span aria-hidden="true">▲</span><b>${s.votes}</b></button>
    <div class="body"><a class="title" href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title)}</a>
    <div class="meta"><span>${esc(s.sources[0]?.name || "")}${s.nsources > 1 ? ` <span class="multi">+ ${s.nsources - 1} more source${s.nsources > 2 ? "s" : ""}</span>` : ""}</span><span>${kinds.map(esc).join(" · ")}</span><span>${ago(s.published_at || s.first_seen)}</span></div>
    ${s.summary && !opts.compact ? `<p class="sum">${esc(s.summary.slice(0, 260))}${s.summary.length > 260 ? "…" : ""}</p>` : ""}
    ${opts.listNote ? `<p class="listnote">“${esc(opts.listNote)}”</p>` : ""}
    <div class="row2"><div class="tags">${tags}${orgs}</div><div class="acts"><a href="/story?id=${s.id}">${s.notes ? `${s.notes} note${s.notes > 1 ? "s" : ""}` : "Notes"}</a><button type="button" class="save linkish">${s.saved ? "Saved ✓" : "Save"}</button></div></div></div>`;
  li.querySelector(".vote").onclick = async (e) => { const b = e.currentTarget; const r = await api(`/api/stories/${s.id}/vote`, { method: "POST" }); b.classList.toggle("on", r.voted); b.setAttribute("aria-pressed", r.voted); b.querySelector("b").textContent = r.votes; };
  li.querySelector(".save").onclick = async (e) => { const b = e.currentTarget; const r = await api(`/api/stories/${s.id}/save`, { method: "POST" }); b.textContent = r.saved ? "Saved ✓" : "Save"; };
  return li;
}
const fmtDate = (s) => s ? new Date(s.replace(" ", "T") + (s.includes("Z") ? "" : "Z")).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";
