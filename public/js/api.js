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
    signal: opts.signal,
  });
  let data = {}; try { data = await res.json(); } catch (e) {}
  if (res.status === 401 && !opts.allow401) { location.href = "/?next=" + encodeURIComponent(location.pathname + location.search + location.hash); throw new Error("Please sign in."); }
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status}).`);
  if (path === "/api/me") window.SI_PUBLIC_NAV = data.publicNav || [];
  return data;
}

// Core pages; modules add theirs through the "ui.nav" extension point (returned with /api/me as user.nav).
// Core pages; [href, label, feature]: a page with a feature shows only when this version of the site has it (lib/profile.js).
const NAV = [["/", "Feed"], ["/?saved=1&days=", "Saved"], ["/brief", "Weekly brief", "brief"], ["/lists", "Reading lists", "lists"], ["/sources", "Sources"]];
const PAGE_FEATURE = { "/brief": "brief", "/lists": "lists" };
async function requireUser() {
  const { user } = await api("/api/me", { allow401: true });
  if (!user) { location.href = "/?next=" + encodeURIComponent(location.pathname + location.search + location.hash); throw new Error("Not signed in"); }
  topbar(user);
  const need = PAGE_FEATURE[location.pathname.replace(/\.html$/, "")];
  if (need && !(user.features || []).includes(need)) { const m = document.querySelector("main"); if (m) m.innerHTML = `<div class="panel"><h1>Not in this version</h1><p class="muted">This page is an extra beyond the shared spec. It runs when the site uses the extended profile (SITE_PROFILE=extended).</p><p><a href="/">Back to the feed</a></p></div>`; return new Promise(() => {}); } // stop here: the page stays on the notice
  return user;
}
function workspaceNavigation(user, current) {
  const nav = user?.nav || [], available = [...(user ? NAV.filter(([, , f]) => !f || user.features?.includes(f)).map(([href,label])=>({href,label})) : [{href:"/",label:"Feed"},{href:"/welcome",label:"About"}]), ...nav, ...(!user ? (window.SI_PUBLIC_NAV || []) : [])];
  const known = {"/story":"Story", "/m/content":"Content desk"};
  if (nav.some(x=>x.href==='/m/review')) available.push({href:'/m/dossier',label:'Topic dossiers'});
  const group = entry => entry.admin ? "Administration" : /^\/m\/(review|map|learn|lab|dossier|sources|arena|journal|glossary)/.test(entry.href) ? "Research" : "Reading";
  const isCurrent = href => { const url = new URL(href,location.origin); return url.pathname===current && (current!=="/" || (url.searchParams.get("saved")==="1") === (new URLSearchParams(location.search).get("saved")==="1")); };
  const selected = available.find(x=>isCurrent(x.href));
  const label = known[current] || selected?.label || document.title.split(" · ")[0];
  const category = selected ? group(selected) : "Reading";
  const parent = category === "Administration" ? available.find(x=>x.href==="/m/admin") : category === "Research" ? available.find(x=>x.href==="/m/map") : null;
  document.querySelector(".workspace-context")?.remove();
  const main = document.querySelector("main") || document.querySelector("#app"); if (!main) return;
  const context = document.createElement("div"); context.className="workspace-context";
  context.innerHTML = `<nav aria-label="Breadcrumb"><ol><li><a href="/">Feed</a></li>${parent && parent.href !== current ? `<li><a href="${esc(parent.href)}">${esc(category)}</a></li>` : ""}${current !== "/" ? `<li><span aria-current="page" id="pageContextLabel">${esc(label)}</span></li>` : `<li><span aria-current="page">${new URLSearchParams(location.search).has("saved") ? "Saved" : "Stories"}</span></li>`}</ol></nav><details class="workspace-directory"><summary>Browse pages</summary><div class="directory-body"><label>Find a page<input type="search" autocomplete="off" placeholder="Search page names" class="directory-search"></label><p class="small muted directory-count" role="status"></p>${["Reading","Research","Administration"].map(category=>{const entries=available.filter(x=>group(x)===category);return entries.length ? `<section><h2>${category}</h2><ul>${entries.map(x=>`<li><a href="${esc(x.href)}"${isCurrent(x.href) ? ' aria-current="page"' : ""}>${esc(x.label)}</a></li>`).join("")}</ul></section>`:"";}).join("")}</div></details>`;
  const compact = current === "/" && main.querySelector(".feed-results");
  if (compact) { context.querySelector("nav").remove(); context.classList.add("feed-context"); compact.append(context); } else main.prepend(context);
  const directory = context.querySelector("details"), search = context.querySelector("input");
  search.oninput=()=>{let count=0;for(const li of context.querySelectorAll(".directory-body li")){li.hidden=!li.textContent.toLowerCase().includes(search.value.trim().toLowerCase());if(!li.hidden)count++;}for(const section of context.querySelectorAll("section"))section.hidden=![...section.querySelectorAll("li")].some(x=>!x.hidden);context.querySelector(".directory-count").textContent=`${count} pages match.`;};
  directory.addEventListener("keydown", e=>{if(e.key==="Escape"){directory.open=false;directory.querySelector("summary").focus();}});
}
function setPageContext(label) { const el = document.querySelector("#pageContextLabel"); if (el) el.textContent = label; }
function topbar(user) {
  const here = location.pathname.replace(/\.html$/, "").replace(/\/index$/, "/") || "/";
  const bar = document.createElement("header"); bar.className = user ? "topbar" : "topbar guest";
  // Module links from "ui.nav": reader-facing ones sit in the bar; admin tools go in one Admin menu.
  window.SI_USER = user || null;
  const nav = user?.nav || [], isHere = (h) => { const destination = new URL(h, location.origin); return destination.pathname === "/" ? here === "/" && ((destination.searchParams.get("saved") === "1") === (new URLSearchParams(location.search).get("saved") === "1")) : here.startsWith(destination.pathname); };
  const mod = nav.filter((n) => !n.admin), tools = nav.filter((n) => n.admin);
  const core = (user ? NAV : [["/", "Feed"], ...(window.SI_PUBLIC_NAV || []).map(n=>[n.href,n.label]), ["/welcome", "About"]]).filter(([, , f]) => !f || (user?.features || []).includes(f));
  const links = [core[0], ...mod.filter((n) => (n.order ?? 50) < 20).map((n) => [n.href, n.label]), ...core.slice(1), ...mod.filter((n) => (n.order ?? 50) >= 20).map((n) => [n.href, n.label])];
  const menu = tools.length ? `<details class="navmenu"${tools.some((n) => isHere(n.href)) ? ' data-here=""' : ""}><summary>Admin</summary><div>${tools.map((n) => `<a href="${n.href}"${isHere(n.href) ? ' aria-current="page"' : ""}>${n.label}</a>`).join("")}</div></details>` : "";
  const toolLinks = tools.length ? `<div class="nav-tools"><p class="small muted">Administration</p>${tools.map((n) => `<a href="${esc(n.href)}"${isHere(n.href) ? ' aria-current="page"' : ""}>${esc(n.label)}</a>`).join("")}</div>` : "";
  bar.innerHTML = `<a class="skip-link" href="#mainContent">Skip to content</a><div class="in"><a class="brand" href="/" aria-label="Superintelligence Homepage"><span class="brand-long">Superintelligence Homepage</span><span class="brand-short">SI Homepage</span></a><button class="btn nav-toggle" id="navToggle" type="button" aria-expanded="false" aria-controls="siteNav">Menu</button><nav class="nav" id="siteNav" aria-label="Main navigation">${links.map(([h, t]) => `<a href="${esc(h)}"${isHere(h) ? ' aria-current="page"' : ""}>${esc(t)}</a>`).join("")}${toolLinks}</nav>
    <div class="who">${menu}${user ? `<span>${esc(user.name)}</span><button class="btn" id="logout" type="button">Sign out</button>` : `<a class="btn" href="/?signin=1">Sign in</a>`}</div></div>`;
  document.querySelector(".topbar")?.remove(); document.body.prepend(bar);
  const main = document.querySelector("main") || document.querySelector("#app"); if (main) { if (!main.id) main.id = "mainContent"; bar.querySelector(".skip-link").href = `#${main.id}`; main.setAttribute("tabindex", "-1"); }
  const toggle = bar.querySelector("#navToggle"), setOpen = (open) => { bar.toggleAttribute("data-nav-open", open); toggle.setAttribute("aria-expanded", String(open)); };
  toggle.onclick = () => setOpen(toggle.getAttribute("aria-expanded") !== "true");
  bar.addEventListener("keydown", (e) => { if (e.key === "Escape") { if (bar.hasAttribute("data-nav-open")) { setOpen(false); toggle.focus(); } for (const d of bar.querySelectorAll("details[open]")) { d.open = false; d.querySelector("summary").focus(); } } });
  document.addEventListener("pointerdown", (e) => { if (!bar.contains(e.target)) { setOpen(false); for (const d of bar.querySelectorAll("details[open]")) d.open = false; } });
  workspaceNavigation(user, here);
  if ((window.SI_PUBLIC_NAV || []).some(n=>n.href==="/m/glossary") && !document.querySelector('script[data-term-loader]')) { const script=document.createElement("script"); script.src="/js/terms.js"; script.dataset.termLoader=""; document.head.append(script); }
  const lo = $("#logout"); if (lo) lo.onclick = async () => { lo.disabled = true; try { await api("/api/logout", { method: "POST" }); location.href = "/?signin=1"; } catch (e) { lo.disabled = false; lo.textContent = "Retry sign out"; lo.title = e.message; } };

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
const KIND = { papers: "Paper", journal: "Journal", people: "Person", lab: "Lab", "research-org": "Research org", forum: "Forum", newsletter: "Newsletter", academic: "Academic", community: "Community", news: "News", policy: "Policy", submitted: "Reader-submitted" };
// Significance score explanation, one line per factor (the same lines the story page shows as a table).
const sigWhy = (an) => ["Significance " + (an.significance ?? 0) + "/100", ...(an.why || []).map((w) => `+${w.points} ${w.factor}${w.detail ? ": " + w.detail : ""}`)].join("\n");
const fmtScore = (sc) => sc.unit === "%" ? `${sc.value}%` : sc.unit === "hours" ? (sc.value >= 1 ? `${+sc.value.toFixed(1)} h` : `${Math.round(sc.value * 60)} min`) : String(sc.value);
// Dates are disclosed as UTC, with publication and first-seen semantics kept separate.
function storyDate(s) {
  const raw = s.published_at || s.first_seen, label = s.published_at ? "Published" : "First seen";
  let value = String(raw || "").replace(" ", "T");
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value), originalDate = value;
  if (dateOnly) value += "T00:00:00";
  if (value && !/(Z|[+-]\d{2}:?\d{2})$/i.test(value)) value += "Z";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '<span class="muted">Date unavailable</span>';
  const iso = date.toISOString();
  if (dateOnly && iso.slice(0, 10) !== originalDate) return '<span class="muted">Date unavailable</span>';
  return `<details class="story-date"><summary aria-label="${label}: ${esc(ago(iso))}; expand for date details">${esc(ago(iso))}</summary><p>${label}: <time datetime="${dateOnly ? originalDate : iso}">${esc(dateOnly ? originalDate + " (time unavailable)" : iso.replace("T", " ").replace(".000Z", " UTC"))}</time></p></details>`;
}
// A view of the existing score factors; meters show points out of the same 100-point scale.
function evidenceBreakdown(s) {
  const factors = s.analysis?.why || [];
  return `<p class="small muted">Rule-based significance: a reading aid, not confidence or scientific validity.</p>${factors.length ? `<ul class="evidence-factors">${factors.map((f) => `<li><span>${esc(f.factor)} <b>+${esc(f.points)}</b></span><meter min="0" max="100" value="${Math.max(0, Math.min(100, Number(f.points) || 0))}" aria-label="${esc(f.factor)}: ${esc(f.points)} points out of 100">${esc(f.points)} points</meter><small class="muted">${esc(f.detail || "")}</small></li>`).join("")}</ul>` : '<p class="small">No factor breakdown is available for this story.</p>'}`;
}
let cardSequence = 0;
// One story card, used by the feed, lists and saved views.
function storyCard(s, opts = {}) {
  const li = document.createElement("li"); li.className = "story"; li.dataset.id = s.id; li.id = `story-${s.id}`; li.tabIndex = -1;
  const tags = s.topics.filter((t) => !t.via).slice(0, 4).map((t) => `<a class="tag" href="/?topic=${t.id}" title="${t.matched.length ? "Matched: " + esc(t.matched.join(", ")) : ""}">${esc(t.label)}</a>`).join("");
  const orgs = s.orgs.slice(0, 2).map((o) => `<a class="tag org" href="/?org=${o.id}">${esc(o.label)}</a>`).join("");
  const kinds = [...new Set(s.sources.map((x) => KIND[x.kind] || x.kind))];
  const an = s.analysis || {}, sig = s.significance || 0, evidenceId = `evidence-${s.id}-${++cardSequence}`;
  // A research write-up among the sources carries its judgement (the "rigor-badges" feature): verdict, credibility, grade.
  const rg = (s.sources.find((x) => x.rigor && x.rigor.verdict) || {}).rigor;
  const rigorBadge = rg ? `<a class="rigor${rg.verdict === "doubtful" ? " low" : ""}" href="${esc((s.sources.find((x) => x.rigor === rg) || {}).url || "#")}" target="_blank" rel="noopener noreferrer" title="Research write-up: ${esc(rg.verdict)}, credibility ${esc(rg.credibility ?? "?")}/100, source grade ${esc(rg.grade || "?")}${rg.panel && rg.panel !== "none" ? `, model panel ${esc(rg.panel)}` : ""}">${esc(rg.verdict)} · ${esc(rg.credibility ?? "?")}${rg.grade ? ` · ${esc(rg.grade)}` : ""}</a>` : "";
  const sigBadge = `<button type="button" class="sig evidence-toggle ${sig >= 60 ? "hi" : sig >= 35 ? "mid" : ""}" aria-expanded="false" aria-controls="${evidenceId}" aria-label="Explain significance: ${sig} out of 100">${sig}</button>`;
  const bench = (an.benchmarks || []).slice(0, 3).map((b) => `<a class="tag bench" href="/?benchmark=${esc(b.id)}" title="Benchmark${b.score ? `: reported ${esc(b.score.raw)}` : ""}">${esc(b.label)}${b.score ? ` <b>${esc(fmtScore(b.score))}</b>` : ""}</a>`).join("");
  li.innerHTML = `<button class="vote ${s.voted ? "on" : ""}" type="button" aria-pressed="${s.voted}" aria-label="Upvote"><span aria-hidden="true">▲</span><b>${s.votes}</b></button>
    <div class="body"><a class="title" href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title)}</a>
    <div class="meta">${sigBadge}${rigorBadge}${an.type ? `<span class="utype">${esc(an.type.label)}</span>` : ""}<span>${esc(s.sources[0]?.name || "")}${s.nsources > 1 ? ` <span class="multi">+ ${s.nsources - 1} more source${s.nsources > 2 ? "s" : ""}</span>` : ""}</span><span>${kinds.map(esc).join(" · ")}</span>${storyDate(s)}</div>
    <section class="evidence-panel" id="${evidenceId}" aria-label="Significance explanation" hidden></section>
    ${s.summary && !opts.compact ? `<p class="sum">${esc(s.summary.slice(0, 260))}${s.summary.length > 260 ? "…" : ""}</p>` : ""}
    ${opts.listNote ? `<p class="listnote">“${esc(opts.listNote)}”</p>` : ""}
    <div class="row2"><div class="tags">${bench}${tags}${orgs}</div><div class="acts"><a href="/story?id=${s.id}">${s.notes ? `${s.notes} note${s.notes > 1 ? "s" : ""}` : "Notes"}</a><button type="button" class="save linkish" aria-pressed="${s.saved}">${s.saved ? "Saved ✓" : "Save"}</button></div></div><p class="action-feedback small" role="status" aria-live="polite" hidden></p></div>`;
  const dateDetails = li.querySelector(".story-date");
  dateDetails?.addEventListener("keydown", (e) => { if (e.key === "Escape" && dateDetails.open) { e.preventDefault(); e.stopPropagation(); dateDetails.open = false; dateDetails.querySelector("summary").focus(); } });
  const toggle = li.querySelector(".evidence-toggle"), panel = li.querySelector(".evidence-panel");
  toggle.onclick = () => { const open = toggle.getAttribute("aria-expanded") !== "true"; toggle.setAttribute("aria-expanded", String(open)); if (open && !panel.childElementCount) panel.innerHTML = evidenceBreakdown(s); panel.hidden = !open; };
  li.addEventListener("keydown", (e) => { if (e.key === "Escape" && !panel.hidden) { e.preventDefault(); e.stopPropagation(); panel.hidden = true; toggle.setAttribute("aria-expanded", "false"); toggle.focus(); } });
  if (opts.detail) {
    const title = li.querySelector(".title"), heading = document.createElement("h1"); heading.className = "story-heading"; heading.textContent = s.title; title.replaceWith(heading);
    const source = li.querySelector(".acts a"); source.textContent = "Open original source"; source.href = s.url; source.target = "_blank"; source.rel = "noopener noreferrer";
  } else {
    const from = opts.returnTo || (location.pathname === "/" ? location.pathname + location.search + `#story-${s.id}` : "");
    if (from) li.querySelector(".acts a").href += "&from=" + encodeURIComponent(localReturnPath(from));
  }
  const feedback = li.querySelector(".action-feedback");
  async function mutate(button, kind) {
    if (!window.SI_USER) { location.href = "/?next=" + encodeURIComponent(location.pathname + location.search); return; }
    if (button.disabled) return; button.disabled = true; feedback.hidden = false; feedback.className = "action-feedback small muted"; feedback.textContent = "Saving…";
    try {
      const r = await api(`/api/stories/${s.id}/${kind}`, { method: "POST" });
      if (kind === "vote") { s.voted = r.voted; s.votes = r.votes; button.classList.toggle("on", r.voted); button.setAttribute("aria-pressed", String(r.voted)); button.querySelector("b").textContent = r.votes; }
      else { s.saved = r.saved; button.textContent = r.saved ? "Saved ✓" : "Save"; button.setAttribute("aria-pressed", String(r.saved)); }
      feedback.textContent = kind === "save" ? (r.saved ? "Saved for later." : "Removed from saved stories.") : (r.voted ? "Vote added." : "Vote removed.");
      if (opts.onChange) opts.onChange(s, kind);
    } catch (e) { feedback.className = "action-feedback err"; feedback.textContent = `${e.message} Your change was not confirmed. Try again.`; }
    finally { button.disabled = false; }
  }
  if (!window.SI_USER) { if (!opts.detail) li.querySelector(".acts a").textContent = "Read story"; li.querySelector(".vote").title = "Sign in to vote"; li.querySelector(".save").textContent = "Sign in to save"; }
  li.querySelector(".vote").onclick = (e) => mutate(e.currentTarget, "vote");
  li.querySelector(".save").onclick = (e) => mutate(e.currentTarget, "save");
  return li;
}
const fmtDate = (s) => s ? new Date(s.replace(" ", "T") + (s.includes("Z") ? "" : "Z")).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";

// Keep sign-in return navigation inside this app, including its workspace fragment.
function localReturnPath(value) {
  if (typeof value !== "string" || !value.startsWith("/")) return "/";
  try { const url = new URL(value, location.origin); return url.origin === location.origin ? `${url.pathname}${url.search}${url.hash}` : "/"; }
  catch { return "/"; }
}
