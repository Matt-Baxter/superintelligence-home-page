#!/usr/bin/env node
// The superintelligence rubric (lib/si-rubric.js, lib/ontology.json "si_rubric"): deterministic, grounded in the
// ontology, negation-aware, and every level adds up from its reasons. Synthetic test data only.
const R = require("../lib/si-rubric"), { ontology, tag } = require("../lib/tagger"), A = require("../lib/analysis");
const concepts = new Set((require("../modules/learn/data/concepts.json").concepts || []).map((c) => c.id)), topics = new Set(ontology.topics.map((t) => t.id));
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log(c ? "  ✓" : "  ✗", m); };
const P = (title, text = "") => R.profile({ title, text, topics: tag(title, text).topics });
const dims = ontology.si_rubric.dimensions;
ok(dims.length === 8 && new Set(dims.map((d) => d.id)).size === 8, "eight dimensions with unique ids");
ok(dims.every((d) => ["capability", "control", "risk"].includes(d.axis) && d.means && d.terms.length), "each dimension has an axis, a plain-words meaning and match terms");
ok(dims.every((d) => d.topics.every((t) => topics.has(t))) && ontology.si_rubric.destination.topics.every((t) => topics.has(t)), "every rubric topic is an ontology topic");
ok(dims.every((d) => d.concepts.every((c) => concepts.has(c))), "every rubric concept is a Learn concept");
const t = "Sample (test data): a research agent improves its own code", x = "It raises held-out scores by 12% over 40 tasks; we audit each update for reward hacking.";
ok(JSON.stringify(P(t, x)) === JSON.stringify(P(t, x)), "same text, same profile (deterministic)");
const p = P(t, x);
ok(p.dimensions.every((d) => d.level === d.why.reduce((a, w) => a + w.points, 0) && d.level >= 0 && d.level <= 3), "every level adds up from its reasons and stays within 0..3");
ok(p.dimensions.find((d) => d.id === "self-improvement").level === 2 && p.stance === "both", `self-improvement (its number is in another sentence, so 2 of 3) audited for reward hacking is "both" (${p.summary})`);
ok(P("Sample (test data): no evidence of recursive self-improvement").stance === "none", "a negated mention earns nothing, topic included");
ok(P("Sample (test data): sparse autoencoders on a model", "Results appear in 3 tables.").dimensions.find((d) => d.id === "legibility").why.every((w) => w.kind !== "measured"), "a number counts as a measurement only in the same sentence as the term");
ok(P("Sample (test data): AGI is basically here").stance === "adjacent" && P("Sample (test data): AGI is basically here").engaged === 0, "naming AGI or superintelligence places a piece on the path but scores no dimension");
ok(P("Sample (test data): a sourdough recipe", "Rest the dough for 12 hours.").relevance === 0, "off-topic text has relevance 0");
const a = A.analyze({ title: t, summary: x }, { kinds: ["papers"] });
ok(a.si && a.why.some((w) => w.factor === "Path to superintelligence") && a.significance === a.why.reduce((s, w) => s + w.points, 0), "the story analysis carries the profile and its significance still adds up from its reasons");
ok(R.criteria().dimensions.map((d) => d.id).join() === dims.map((d) => d.id).join(), "the published criteria list exactly the dimensions the code scores");

// Properties over the labelled synthetic set (bench/si-rubric-set.json): the profile depends on what the text says,
// not on its casing, spacing, sentence order or unrelated padding; negating every mention removes it; a measurement
// added in the same sentence never lowers a level.
const SET = require("../bench/si-rubric-set.json").items;
const stance = (t, x) => P(t, x).stance, levels = (t, x) => P(t, x).dimensions.map((d) => d.level).join("");
const sentencesOf = (x) => x.split(/(?<=[.!?])\s+/);
ok(SET.every((x) => levels(x.title, x.text) === levels(x.title, x.text.toUpperCase().toLowerCase()) && levels(x.title, x.text) === levels(x.title, x.text.replace(/ /g, "  ").replace(/\. /g, ".\n"))), "spacing and line breaks never change a profile");
ok(SET.every((x) => { const s = sentencesOf(x.text); return s.length < 2 || stance(x.title, x.text) === stance(x.title, [...s].reverse().join(" ")); }), "reordering sentences never changes the stance");
ok(SET.every((x) => levels(x.title, x.text) === levels(x.title, `${x.text} The weather was mild and the office reopened on Monday.`)), "an unrelated sentence never changes a profile");
ok(SET.filter((x) => x.split === "dev").every((x) => { const p0 = P(x.title, x.text), p1 = P(x.title, `${x.text.replace(/\.\s*$/, "")}, measured on 40 tasks.`); return p1.dimensions.every((d, i) => d.level >= p0.dimensions[i].level); }), "adding a measurement never lowers a level");
ok(P("Sample (test data): no sparse autoencoders and no reward hacking", "We did not use sparse autoencoders and found no reward hacking.").engaged === 0, "a text that negates every mention engages nothing");
console.log(`\nsi-rubric unit: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
