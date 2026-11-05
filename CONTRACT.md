# Contract

_What we're building against._

**Team:** Matt Baxter & John Affolter
**Current version:** 0.1
**Date:** _YYYY-MM-DD_
**Option:** _Split / Bake-off_ (must match the Working Agreement)

> Fill in the section for the option we choose and delete the other one.

## Change log

Both partners approve every change, and every change gets logged here.

| Version | Date | Change | Approved by |
|---------|------|--------|-------------|
| 0.1 | _YYYY-MM-DD_ | Initial draft | _Matt, John_ |

---

## Option A: Split

### Purpose

Lets two components fit together.

- **Component 1:** _e.g. frontend (owner: ...)_
- **Component 2:** _e.g. API / backend (owner: ...)_

### Core content

#### API endpoints

| Method | Path | Description | Auth required |
|--------|------|-------------|---------------|
| _POST_ | _/api/auth/signup_ | _Create an account_ | _No_ |
| _POST_ | _/api/auth/login_ | _Log in_ | _No_ |
| _GET_ | _/api/..._ | _..._ | _Yes_ |

#### Request and response formats

_For each endpoint, an example request and response, e.g.:_

```http
POST /api/auth/login
Content-Type: application/json

{ "email": "user@example.com", "password": "..." }
```

```json
200 OK
{ "token": "...", "user": { "id": "...", "email": "user@example.com" } }
```

#### Data models

| Model | Fields | Notes |
|-------|--------|-------|
| _User_ | _id, email, passwordHash, createdAt_ | _..._ |
| _..._ | _..._ | _..._ |

#### Auth

_How accounts and sessions work (e.g. email/password or OAuth provider, token/session type, how the frontend sends it), and how data is kept per-user (multi-user persistence)._

### Rules

#### Error handling

_Standard error response format and status codes, e.g.:_

```json
{ "error": { "code": "NOT_FOUND", "message": "Item not found" } }
```

| Status | When |
|--------|------|
| 400 | _Invalid input_ |
| 401 | _Not logged in_ |
| 403 | _Logged in but not allowed_ |
| 404 | _Not found_ |
| 500 | _Server error_ |

#### Mock data

_Where the mock data/server lives and how each side builds against it before the other is ready._

#### Database schema ownership

_Who owns the database schema and how schema changes are proposed._

### Decision point: Integration milestones

| Milestone | Target date | Done when |
|-----------|-------------|-----------|
| _Contract v1.0 agreed_ | _..._ | _..._ |
| _Both sides working against mocks_ | _..._ | _..._ |
| _First end-to-end integration_ | _..._ | _..._ |
| _Mid-point swap_ | _..._ | _..._ |
| _Deployed & shared with class_ | _1–2 weeks before presentation_ | _..._ |

### Changes

Both partners approve and log them (see [Change log](#change-log)).

---

## Option B: Bake-off

### Purpose

Keeps the comparison fair.

- **Partner 1 platform:** _Matt: ..._
- **Partner 2 platform:** _John: ..._

### Core content: One shared spec

_Link to the shared spec (SpecKit), plus a summary here._

#### Required features

1. _Accounts: sign up, log in, log out_
2. _Multi-user persistence: each user's data is saved and only visible to them_
3. _..._

#### Acceptance tests

| # | Feature | Given / When / Then | Matt's build | John's build |
|---|---------|---------------------|--------------|--------------|
| 1 | _Sign up_ | _Given a new email, when I sign up, then I'm logged in_ | ☐ | ☐ |
| 2 | _..._ | _..._ | ☐ | ☐ |

### Rules

- **Can differ between builds:** _e.g. platform, agent/AI tools, UI styling, internal code structure_
- **Stays fixed:** _e.g. required features, acceptance tests, data model, synthetic data set, time box_

### Decision point

#### Comparison criteria

| Criterion | Weight | Matt's build | John's build |
|-----------|--------|--------------|--------------|
| _Acceptance tests passed_ | _..._ | | |
| _Ease of deployment_ | _..._ | | |
| _Code quality / maintainability_ | _..._ | | |
| _Cost_ | _..._ | | |
| _UX_ | _..._ | | |

#### How we'll choose or merge the final version

_e.g. score both builds, pick the winning base, then port the best parts of the other build._

### Changes

Both partners approve and log them (see [Change log](#change-log)).
