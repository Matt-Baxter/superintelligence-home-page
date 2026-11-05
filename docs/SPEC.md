# Initial spec

SEIS 606 Project 2 · Superintelligence Homepage · from our Project 2 Plan doc, Nov 4, 2026

The homepage pulls AI-progress writing from many kinds of sources, groups duplicates into one story, tags each story by topic with a reason you can see, and lets signed-in readers vote, save, annotate and build shared reading lists.

**Problem.** Following AI progress means checking arXiv, a dozen lab blogs, research orgs, forums and newsletters. Aggregators exist, but Paul pointed out that [AI Digest](https://ai.jenquist.com/) leans heavily on Twitter. That misses long-form sources and goes stale when one platform changes.

**Users.** Students and researchers who want a daily read on AI progress, plus small groups (a class, a lab) who want to curate and discuss it together.

## How we do better than AI Digest

| AI Digest | Superintelligence Homepage |
| --- | --- |
| Mostly Twitter/X posts | Papers, lab blogs, research orgs, forums, newsletters, academic blogs, community news. No dependence on any one platform |
| Each post stands alone | The same paper or announcement from several sources becomes one story, showing every source that covered it |
| Topics are implicit | Every story is tagged against a published ontology (reasoning, agents, safety, compute, policy, and others), and each tag shows the words that triggered it |
| Read-only | Accounts: vote, save for later, private notes, shared reading lists, suggest a source |
| A stream | A weekly brief: top stories per topic and which topics are rising |

## Features by priority

1. **Must have (the class requirements):** accounts; a feed from at least 8 sources across at least 5 source kinds; story grouping; ontology tags with reasons; voting and saving that persist per user; the agent log page; deployed and shared with the class.
2. **Should have:** filter by topic, source kind and organization; private notes on a story; shared reading lists other users can follow; a weekly brief page.
3. **Could have:** users suggest new sources (approved by an admin); email digest; an AI-written summary per story, clearly labelled as AI-generated.

**Sources at launch.** arXiv (cs.AI, cs.LG), Hugging Face Daily Papers, OpenAI News, Google DeepMind blog, Google Research blog, Alignment Forum, Epoch AI, Import AI, BAIR blog and Hacker News filtered to AI (`lib/sources.json`). Each is read through its public feed or API, so anything that moves can be edited from the Sources page.

**Ontology.** 17 topics in a tree (for example Capabilities → Reasoning, Agents; Safety → Interpretability, Security), plus 11 organizations. It lives in one JSON file both of us can edit (`lib/ontology.json`), so tagging rules are reviewable in a pull request rather than buried in code.

**Non-goals.** Social media scraping, full-text article hosting (we link out), and real-time chat.

## Open questions

**For us to settle this week**

- [ ] Matt confirms the area split, his agents, and the $10 monthly cap.
- [ ] Check-in days and times, and which chat tool we use.
- [ ] Final name for the site.
- [ ] Which of John's existing content and code we reuse (for example the json-render views and the ontology work).

**For Paul**

- [ ] What is our presentation date? It sets the share-with-class deadline.
- [ ] Is a self-hosted agent log page acceptable, or should it also live in the repo as a Markdown file?
- [ ] Can classmates sign up themselves, or should we pre-create accounts?
