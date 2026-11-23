// Guards lib/feeds.js citedPapers(): a newsletter or lab-blog post that links arXiv / DOI papers carries those papers
// (resolved to the same keys stories group by) so the site can link back to the real study. Run: node test/cited-papers-unit.js
const assert = require("node:assert"), { parseXml } = require("../lib/feeds.js");
let passed = 0; const t = (name, fn) => { try { fn(); passed++; } catch (e) { console.error("✗ " + name); throw e; } };
const rss = (link, body) => `<rss><channel><item><title>Post</title><link>${link}</link><description>${body}</description></item></channel></rss>`;

t("extracts arXiv abs, pdf and html links as one key each", () => {
  const [item] = parseXml(rss("https://importai.substack.com/p/x",
    "&lt;a href=&quot;https://arxiv.org/abs/2401.01234&quot;&gt;paper&lt;/a&gt; and https://arxiv.org/pdf/2401.01234v2. and https://arxiv.org/html/2402.05678"));
  assert.ok(item.papers, "papers missing");
  assert.deepStrictEqual(item.papers.map((p) => p.key).length, 2);
});

t("extracts DOI links", () => {
  const [item] = parseXml(rss("https://blog.example.org/a", "see https://doi.org/10.1038/s41586-024-07000-1"));
  assert.strictEqual(item.papers.length, 1);
  assert.match(item.papers[0].url, /10\.1038/);
});

t("does not cite a paper's own page", () => {
  const [item] = parseXml(rss("https://arxiv.org/abs/2401.01234", "https://arxiv.org/abs/2401.01234"));
  assert.strictEqual(item.papers, undefined);
});

t("posts with no paper links carry no papers field", () => {
  const [item] = parseXml(rss("https://blog.example.org/b", "no links here https://example.com/page"));
  assert.strictEqual(item.papers, undefined);
});

t("caps at five papers", () => {
  const body = Array.from({ length: 8 }, (_, i) => `https://arxiv.org/abs/2401.0${1000 + i}`).join(" ");
  const [item] = parseXml(rss("https://blog.example.org/c", body));
  assert.strictEqual(item.papers.length, 5);
});

console.log(`${passed} cited-paper checks passed.`);
