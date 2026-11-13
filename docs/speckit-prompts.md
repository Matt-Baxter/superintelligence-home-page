# Spec Kit prompts

The prompts we gave each Spec Kit command, kept here so we can show how the spec was produced.
They're drafted from our Project 2 plan doc, the SEIS 606 Week 2 slides (spec prompt format:
objective, behavior, constraints, verification) and the Spec Kit workshop chapters 2 and 3.
Matt's direction: keep both the constitution and the spec as simple as possible.

## 1. `/speckit-constitution`

```text
Create a short, simple constitution for the Superintelligence Homepage, a small web app where
signed-in users follow progress toward advanced AI from many open sources.

Project 2 is a platform bake-off: Matt (Claude Code) and John (v0) each build the whole app from
this same constitution and spec, then compare the two builds and merge the best parts. So the
constitution must not pick a language, framework, database or host; those belong in each
partner's plan.

Principles:
- Simplicity first: the simplest thing that meets the spec wins. No abstractions, services or
  dependencies the spec doesn't need. Keep it small enough for two students to finish in a few weeks.
- Spec first and traceable: every requirement has an ID (REQ-001...). Plans, tasks, code and
  tests reference the IDs they satisfy.
- Test what the spec says: every requirement has at least one acceptance test written as
  Given/When/Then, and tests are grouped by requirement ID. Tests use synthetic data only.
- Accounts and data are safe: passwords are never stored in plain text, users can only change
  what they created and the server enforces it, and secrets are never committed or put in prompts.
- Open sources only: content comes from public feeds and links out to the original. No Twitter/X.

Also include:
- Bake-off rules: what both builds must keep the same (the spec, its acceptance tests, the
  required features) and what may differ (platform, tools, internals, styling).
- Workflow: work on branches, the other partner reviews every pull request, a human reviews
  every merge to main, agents never deploy or spend money, and each partner keeps an agent log
  in their own words.
- Costs: free tiers where possible, at most $10 a month total, raised only if both agree.
- Governance: both partners approve changes, bump the version, and note the change.
```

## 2. `/speckit-specify`

Follows the workshop's prompt template (chapter 3) and the slides' spec prompt format
(objective, behavior, constraints, verification). Must-haves come from the "Features by
priority" list in our plan doc; everything else is deferred to keep it simple.

```text
I want to build a simple web app, the Superintelligence Homepage, that gives people one place
to follow progress toward advanced AI, drawn from many open sources instead of one social platform.

OBJECTIVE (the failure we're preventing):
Following AI progress means checking arXiv, a dozen lab blogs, research groups, forums and
newsletters. Existing aggregators lean heavily on Twitter/X, so they miss long-form sources,
show the same paper many times, and break when one platform changes.

TARGET USERS:
- Students and researchers who want a quick daily read on AI progress
- A small group, like our class, who want to vote on and save the stories that matter

KEY FEATURES (must have):
- Create an account, sign in and sign out; stay signed in between visits
- A feed of recent stories pulled automatically from at least 8 public sources across at least
  5 kinds (papers, AI lab blogs, research organizations, forums, newsletters)
- The same paper or announcement covered by several sources shows as one story that lists
  every source
- Each story is tagged by topic (for example reasoning, agents, safety, policy), and the reader
  can see which words caused each tag
- Signed-in users can vote on stories and save them for later; votes and saves are kept per user
- Filter the feed by topic

CRITICAL EXPERIENCES:
- The feed is readable at a glance on a laptop and a phone
- Every story links out to the original source

SUCCESS LOOKS LIKE:
- A classmate can sign up on the live site, see a grouped, tagged feed from at least 8 sources,
  and vote on and save stories that are still there the next time they sign in

CONSTRAINTS:
- Twitter/X is never a source and submitted links to it are refused
- Users can only change their own votes and saves
- No personal data beyond what an account needs
- Must be deployed at a public URL and shared with the class at least 2 weeks before our
  presentation

VERIFICATION:
- Every requirement has Given/When/Then acceptance scenarios a tester can check without
  knowing how the app is built

OUT OF SCOPE (for now):
- Notes, reading lists, a weekly brief, user-suggested sources, email digests, AI-written
  summaries
- Social media scraping, hosting full article text, real-time chat
```

## 3. Amendment: focus on superintelligence (2026-11-06)

Matt's direction: the site is a home page for articles about **superintelligence** specifically,
not AI in general, and the word should run through the constitution and the spec.

`/speckit-constitution`:

```text
Amend the constitution so the project's purpose is superintelligence specifically, not AI in
general. Add a principle that every story on the site must be relevant to superintelligence:
progress toward AGI and superintelligence, frontier capabilities, alignment and safety of
superintelligent systems, interpretability, forecasts and timelines, compute and scaling, and
governance of frontier AI. General AI news (product launches, everyday AI apps, AI in a
specific industry) is out. Readers must be able to see why each story counts as
superintelligence-related.
```

`/speckit-specify` (update the existing spec):

```text
Update the Superintelligence Homepage spec so it is a home page for articles about
superintelligence specifically, not AI in general. Sources should be ones that regularly cover
superintelligence (alignment and safety research, frontier labs, forecasting groups, research
papers on frontier capabilities). Only stories relevant to superintelligence appear in the feed;
stories that match no superintelligence topic are left out rather than shown as "Untagged".
Topic tags should be superintelligence topics, and each story should show which words made it
relevant.
```

## 4. `/speckit-plan` (Build A, Matt) — 2026-11-13

Run by Matt for his own build. John's build (v0) doesn't use Spec Kit.

```text
Build A (Matt's build) for the Superintelligence Homepage bake-off. All application code lives in
builds/matt/; nothing outside that folder except Spec Kit files. Stack: Next.js (App Router) with
TypeScript, deployed on Vercel. Neon Postgres for the database (a separate database from John's
build). Fetch feeds with a Vercel Cron Job every 30 minutes. Simple username/password sign-in with
hashed passwords and a session cookie; no third-party auth service. Plain CSS, no UI framework.
Playwright for acceptance tests, organized by requirement ID, using saved sample feeds. Keep it as
simple as possible: as few dependencies and moving parts as possible. Stay within free tiers.
```
