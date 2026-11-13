// "topic-<id>": one live json-render view per top-level research area (served at /m/view?name=topic-<id>).
// The builder only gathers numbers and records into the spec's `state`; the elements bind to them with $state,
// $template, $cond, repeat/$item and visible, and format them with the operators in views/operators.js ($computed).
// Tabs are plain setState buttons, so switching needs no server call. Text comes from the records, never invented.
const D = require("./dossier");

// The rule for "some support" written as a portable si-expr rule: the view evaluates it with the "rule" operator,
// so the threshold on screen is the one the dossier uses (two credible primary papers and a check that held up).
const SUPPORT_RULE = { "si.let": [{ need: { "-": [2, { min: [2, { var: "credible" }] }] } },
  { if: [{ and: [{ "==": [{ var: "need" }, 0] }, { ">=": [{ var: "linked" }, 1] }] }, "Meets the bar for 'some support'.",
    { "==": [{ var: "need" }, 0] }, "Needs a toy check of a credible paper that held up to reach 'some support'.",
    { cat: ["Needs ", { var: "need" }, { if: [{ "==": [{ var: "need" }, 1] }, " more credible paper", " more credible papers"] }, " and a toy check that held up to reach 'some support'."] }] }] };


// Lab examples and Learn concepts come from module.js through the lab.examples and learn.concepts points (empty when off).
async function build({ db, labExamples = () => [], concepts = () => [] }, topic, { examples = labExamples(), concepts: cs = concepts() } = {}) {
  const d = D.analyse(await D.gather(db, topic), { examples, concepts: cs });
  const papers = d.papers.filter((p) => p.kind === "paper"), pieces = d.papers.filter((p) => p.kind !== "paper");
  const line = (p) => [p.verdict, `credibility ${p.credibility}/100`, p.grade ? `source grade ${p.grade}` : "", p.survey ? "a survey" : ""].filter(Boolean).join(" · ");
  const state = {
    topic: { id: d.topic, label: d.label }, at: d.at, tab: papers.length ? "papers" : d.checks.length ? "checks" : "buzz",
    evidence: d.strength, why: d.why.charAt(0).toUpperCase() + d.why.slice(1), buzzLevel: d.buzz?.level || "quiet", gap: d.buzz?.gap || "", ahead: /more than it has been shown/.test(d.buzz?.gap || ""),
    counts: { papers: papers.length, credible: d.counts.credible, checks: d.checks.length, supported: d.counts.supported, linked: d.counts.linked || 0, pieces: pieces.length, buzz: d.buzz?.items || 0 },
    papers: papers.slice(0, 8).map((p) => ({ title: p.title, line: line(p), url: p.url || "" })),
    checks: d.checks.slice(0, 8).map((c) => ({ title: c.title, line: `${c.supported ? "held up" : "did not hold up"} at toy scale${c.source ? " · from a reviewed paper" : " · a general check"}` })),
    pieces: pieces.slice(0, 6).map((p) => ({ title: p.title, line: line(p) })),
    hasPapers: papers.length > 0, hasChecks: d.checks.length > 0, hasPieces: pieces.length > 0,
  };
  const elements = {}; let n = 0;
  const el = (type, props = {}, children = [], extra = {}) => { const id = `${type.toLowerCase()}-${++n}`; elements[id] = { type, props, children, ...extra }; return id; };
  const tab = (value, label) => el("Button", { label, variant: { $cond: { $state: "/tab", eq: value }, $then: "primary", $else: "secondary" } }, [], { on: { press: { action: "setState", params: { statePath: "/tab", value } } } });
  const list = (path, has, empty) => [
    el("Stack", { gap: "sm" }, [el("Card", { title: { $item: "title" }, subtitle: { $item: "line" } })], { repeat: { statePath: path } }),
    el("Text", { text: empty, tone: "muted" }, [], { visible: { $state: has, not: true } }),
  ];
  const root = el("Stack", { gap: "md" }, [
    el("Callout", { tone: { $cond: { $state: "/ahead" }, $then: "warn", $else: "neutral" }, title: { $computed: "capitalize", args: { value: { $state: "/gap" } } }, text: { $template: "${/why}." } }),
    el("Grid", { columns: 2 }, [
      el("Ladder", { label: "Evidence", levels: ["none yet", "thin", "early", "some support"], value: { $state: "/evidence" }, hint: "reviewed papers and our own toy checks" }),
      el("Ladder", { label: "Buzz", levels: ["quiet", "some", "loud"], value: { $state: "/buzzLevel" }, hint: "never changes the evidence rating" }),
    ]),
    el("Grid", { columns: 4 }, [
      el("Metric", { label: "Reviewed papers", value: { $computed: "str", args: { value: { $state: "/counts/papers" } } }, hint: { $computed: "plural", args: { n: { $state: "/counts/pieces" }, one: "article or post", many: "articles and posts" } } }),
      el("Metric", { label: "Credible share", value: { $computed: "percent", args: { part: { $state: "/counts/credible" }, whole: { $state: "/counts/papers" } } }, hint: "credibility 65 or more" }),
      el("Metric", { label: "Our toy checks", value: { $computed: "ratio", args: { part: { $state: "/counts/supported" }, whole: { $state: "/counts/checks" } } }, hint: "held up at toy scale" }),
      el("Metric", { label: "Buzz, 30 days", value: { $computed: "str", args: { value: { $state: "/counts/buzz" } } }, hint: "news, newsletters, blogs, forums" }),
    ]),
    el("Text", { text: { $computed: "rule", args: { rule: SUPPORT_RULE, credible: { $state: "/counts/credible" }, linked: { $state: "/counts/linked" } } }, tone: "muted", size: "sm" }),
    el("Stack", { gap: "sm", direction: "horizontal" }, [tab("papers", "Papers"), tab("checks", "Our checks"), tab("buzz", "Articles and posts")]),
    el("Card", { title: "Reviewed papers", subtitle: "Judged from their abstracts" }, list("/papers", "/hasPapers", "No papers reviewed on this area yet."), { visible: { $state: "/tab", eq: "papers" } }),
    el("Card", { title: "Our own checks", subtitle: "Small deterministic experiments that test an idea's logic, not a paper's numbers" }, list("/checks", "/hasChecks", "No toy checks on this area yet."), { visible: { $state: "/tab", eq: "checks" } }),
    el("Card", { title: "Articles and posts", subtitle: "Buzz: never changes the evidence rating" }, list("/pieces", "/hasPieces", "No articles or posts reviewed on this area yet."), { visible: { $state: "/tab", eq: "buzz" } }),
    el("Stack", { gap: "sm", direction: "horizontal" }, [
      el("Button", { label: "Open the full dossier", variant: "secondary" }, [], { on: { press: { action: "navigate", params: { href: `/m/dossier#${d.topic}` } } } }),
      el("Button", { label: "Topic feed", variant: "secondary" }, [], { on: { press: { action: "filterTopic", params: { topic: d.topic } } } }),
    ]),
    el("Text", { text: { $template: "Weighed on ${/at}. Rule-based and explainable; a reading aid, not a forecast." }, tone: "muted", size: "sm" }),
  ]);
  return { root, state, elements };
}

module.exports = { build, SUPPORT_RULE };
