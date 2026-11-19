# Superintelligence Homepage — Build A (Matt)

**Live site: https://superintelligence-home-page.vercel.app**

Matt's build for the Project 2 bake-off, made with Claude Code and Spec Kit: a Next.js app on
Vercel with a Neon Postgres database. It shows a feed of superintelligence stories from 11 public
sources, grouped across sources and tagged by topic, with accounts, votes and saves.

- What it must do: [shared spec](../../specs/001-superintelligence-homepage/spec.md)
- How it's built: [plan](../../specs/001-superintelligence-homepage/plan.md) and
  [tasks](../../specs/001-superintelligence-homepage/tasks.md)
- How to run, test and deploy it: [quickstart](../../specs/001-superintelligence-homepage/quickstart.md)

## Checks

GitHub Actions runs these on every pull request and every push to `main` that touches this
folder or the shared spec ([workflow](../../.github/workflows/build-a-ci.yml)). Run them locally
from `builds/matt/`:

```bash
npm run lint             # ESLint (Next.js + TypeScript rules)
npm run typecheck        # TypeScript compiler
npm run test:unit        # unit tests, including a check that the code matches the spec's topic table
npm run test:acceptance  # Playwright acceptance tests (needs a local test database; see the quickstart)
```
