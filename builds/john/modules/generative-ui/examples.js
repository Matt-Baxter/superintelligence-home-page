// Example views that teach data binding and operators with synthetic, labelled test data (no real papers or people).
// Each is a static spec: everything it shows comes from its own `state`. Open at /m/view?name=<name>; copy into the
// Studio to change it. Patterns: $state, $template, $cond, repeat + $item, visible, setState tabs, $computed operators
// (views/operators.js) and a portable si-expr rule evaluated in the browser.
const sample = (title, verdict, cred, kind) => ({ title: `Sample: ${title} (test data)`, line: `${verdict} · credibility ${cred}/100`, kind, cred });

const bindings = (() => {
  const items = [sample("Self-edited agents on held-out tasks", "solid, modest step", 74, "paper"), sample("Sparse features in a toy transformer", "plausible, worth checking", 61, "paper"),
    sample("Why self-improving AI is already here", "doubtful", 20, "post"), sample("A lab's evaluation of agent time horizons", "plausible, worth checking", 58, "report")];
  const state = { title: "Sample research area (test data)", view: "all", items, papers: items.filter((x) => x.kind === "paper"), credible: items.filter((x) => x.cred >= 65).length, total: items.length,
    threshold: 65, rule: { if: [{ ">=": [{ var: "credible" }, 2] }, "two or more credible papers: enough for 'early'", "fewer than two credible papers: stays 'thin'"] } };
  const elements = {
    root: { type: "Stack", props: { gap: "md" }, children: ["intro", "metrics", "ruleText", "tabs", "allCard", "paperCard"] },
    intro: { type: "Callout", props: { tone: "neutral", title: { $template: "${/title}: binding example" }, text: "Every number and line on this view is read from the spec's own state. Switch the tabs: nothing is fetched." }, children: [] },
    metrics: { type: "Grid", props: { columns: 3 }, children: ["m1", "m2", "m3"] },
    m1: { type: "Metric", props: { label: "Pieces", value: { $computed: "str", args: { value: { $state: "/total" } } }, hint: { $computed: "plural", args: { n: { $state: "/total" }, one: "item in state", many: "items in state" } } }, children: [] },
    m2: { type: "Metric", props: { label: "Credible share", value: { $computed: "percent", args: { part: { $state: "/credible" }, whole: { $state: "/total" } } }, hint: { $template: "credibility ${/threshold} or more" } }, children: [] },
    m3: { type: "Metric", props: { label: "Credible", value: { $computed: "ratio", args: { part: { $state: "/credible" }, whole: { $state: "/total" } } }, tone: { $cond: { $state: "/credible", gt: 1 }, $then: "good", $else: "warn" } }, children: [] },
    ruleText: { type: "Text", props: { text: { $computed: "rule", args: { rule: { $state: "/rule" }, credible: { $state: "/credible" } } }, tone: "muted", size: "sm" }, children: [] },
    tabs: { type: "Stack", props: { gap: "sm", direction: "horizontal" }, children: ["tAll", "tPapers"] },
    tAll: { type: "Button", props: { label: "Everything", variant: { $cond: { $state: "/view", eq: "all" }, $then: "primary", $else: "secondary" } }, on: { press: { action: "setState", params: { statePath: "/view", value: "all" } } }, children: [] },
    tPapers: { type: "Button", props: { label: "Papers only", variant: { $cond: { $state: "/view", eq: "papers" }, $then: "primary", $else: "secondary" } }, on: { press: { action: "setState", params: { statePath: "/view", value: "papers" } } }, children: [] },
    allCard: { type: "Card", props: { title: "Everything", subtitle: "repeat over /items" }, visible: { $state: "/view", eq: "all" }, children: ["allList"] },
    allList: { type: "Stack", props: { gap: "sm" }, repeat: { statePath: "/items" }, children: ["allRow"] },
    allRow: { type: "Card", props: { title: { $item: "title" }, subtitle: { $item: "line" } }, children: [] },
    paperCard: { type: "Card", props: { title: "Papers only", subtitle: "repeat over /papers" }, visible: { $state: "/view", eq: "papers" }, children: ["paperList"] },
    paperList: { type: "Stack", props: { gap: "sm" }, repeat: { statePath: "/papers" }, children: ["paperRow"] },
    paperRow: { type: "Card", props: { title: { $item: "title" }, subtitle: { $item: "line" } }, children: [] },
  };
  return { root: "root", state, elements };
})();

module.exports = { "example-bindings": { title: "Example: data binding and operators", description: "Synthetic test data showing $state, $template, $cond, repeat, visible, setState tabs, operators and an si-expr rule.", spec: bindings } };
