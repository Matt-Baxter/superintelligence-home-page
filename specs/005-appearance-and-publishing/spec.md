# Feature Specification: Appearance, CMS delivery and content generation (extended version)

**Feature Branch**: `feature/themes-layouts-cms-2026-11-11`

**Created**: 2026-11-11

**Status**: Proposed, **not approved**. Built on its own `feature/` branch because John asked for it; nothing here is in scope for the bake-off until both partners (John and Matt) approve it (constitution, shared documents). It changes only the extended version (`SITE_PROFILE=extended`): the appearance module is not in the spec or research profiles, and the editorial module was already extended-only. The shared spec (`specs/001-superintelligence-homepage`) is unchanged.

**Numbering**: REQ-053 to REQ-055 are the next free numbers after spec 004. The REQ-032..035 collision between specs 002 and 003 is still open for both partners ([handoff](../../handoff/SI-HANDOFF-2026-11-07.md#2-requirement-numbers-collide)); nothing here renumbers anything.

## Overview

The site has one look (monochrome, following the device's light or dark setting) and an Editorial CMS that publishes original posts to one page. This feature lets the site and each reader choose how it looks, lets published posts reach readers where they already read, and lets an editor start a post from the site's own data instead of a blank page:

1. an admin sets the site's default look; a reader can switch for themselves, kept in their own browser only;
2. themes change neutral tokens only: the accent stays ink (a colour accent is a decision for both partners);
3. published posts go out as RSS, JSON Feed, JSON and an embeddable card; drafts never do;
4. generated drafts are written by rules from stored stories and scores, name no authors, put no claim in anyone's mouth, and stay drafts until a person publishes them;
5. channel versions (blog, newsletter, short posts) are text to copy; nothing is posted, and there is no Twitter/X version.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A reader reads the site the way they like (Priority: P2)

A reader opens Display in the top bar and picks a concept (Reader, Briefing, Magazine, Night desk, Accessible) or a theme, feed layout, headline face and text size on their own. The choice stays on the next page and the next visit in the same browser.

**Independent Test**: On the synthetic fixtures, choosing Magazine sets the newsprint theme and the magazine layout, the first story spans the row, and after a reload the look is the same; "Use the site's look" brings the default back.

**Acceptance Scenarios**:

1. **Given** the site default, **When** a reader picks a concept, **Then** all four settings change to the concept's, and changing one of them afterwards shows the concept as "Custom".
2. **Given** an admin has turned reader switching off, **When** a reader opens any page, **Then** there is no Display menu and the site default applies.
3. **Given** any theme, **When** the unslop check runs, **Then** every text token pair keeps 4.5:1 contrast.

### User Story 2 - An admin sets the site's look (Priority: P2)

An admin opens Admin → Appearance, previews a concept or a mix of settings on the three newest stories, and saves it as the site default.

**Independent Test**: Saving Briefing makes `GET /api/appearance` return the compact layout, a new visitor sees it, and the change is in the admin audit log.

**Acceptance Scenarios**:

1. **Given** an unsaved choice, **When** the admin previews it, **Then** only the Appearance page changes until it is saved.
2. **Given** a reader account, **When** it tries to change the default, **Then** it gets 403.

### User Story 3 - Published posts reach other places (Priority: P3)

An editor publishes a post; it appears in the journal's RSS feed and JSON Feed, has its own JSON address, and can be embedded on another site as a small card.

**Independent Test**: A published Sample post is in both feeds with its escaped title; an unpublished draft is in neither.

### User Story 4 - An editor starts from the site's own data (Priority: P3)

An editor generates a weekly digest, a topic round-up or a story explainer, checks and rewrites it, and copies a blog, newsletter or short-post version.

**Independent Test**: On synthetic stories, the digest takes the last 7 days by significance, the round-up one topic's last 30 days newest first, and the explainer lists each part of one story's score; each is saved as a draft whose history says "generate"; every short post fits its network's limit with the link.

### Edge Cases

- A browser that blocks storage (private mode): the site default applies and nothing breaks.
- A stale cached default after an admin change: the cache lasts at most 5 minutes; saving on the Appearance page clears the admin's own cache.
- No stories in the window, an unknown topic or a story number that isn't on the feed: a plain message, no draft.
- A post at the 200-post limit: generation is refused like any new post.
- A title with `<`, `&` or quotes in the feeds; an embed of an unpublished slug (404).

## Requirements *(mandatory)*

### Functional Requirements

- **REQ-053**: In the extended version, the site SHOULD offer named design concepts that bundle a theme (follow the system, light, dark, high contrast, newsprint), a feed layout (list, compact, cards, magazine), a headline face and a text size; an admin SHOULD set the site default (audited) and choose whether readers may switch; a reader SHOULD be able to switch for themselves, kept in their own browser only. Themes change neutral tokens only, every theme keeps 4.5:1 text contrast, and the accent stays ink.
- **REQ-054**: In the extended version, published editorial posts SHOULD be delivered as an RSS 2.0 feed, a JSON Feed 1.1 feed, JSON per post and an embeddable card, with cache headers; drafts and revisions are never delivered.
- **REQ-055**: In the extended version, an admin SHOULD be able to generate a draft (weekly digest, topic round-up, story explainer) written by rules from the stored stories, their scores and their explanations, which names no authors, attributes no claim to a person, says it must be checked, and stays a draft until a person publishes it; and SHOULD see channel versions of a saved draft (blog Markdown, newsletter, Bluesky, Threads, Mastodon, LinkedIn) within each network's length limit, never posted automatically and with no Twitter/X version.

### Key Entities

- **Site look**: the default concept, theme, layout, headline face, text size and whether readers may switch (`appearance_settings`, one row).
- **Reader look**: a reader's own choice, in their browser's storage only (not personal data on the server).
- **Generated draft**: an ordinary editorial post whose first revision's action is `generate`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-501**: Every option in the catalog has its CSS and every concept names real options (unit check); every theme passes the contrast check.
- **SC-502**: A reader's choice survives a reload and changes nothing for other readers.
- **SC-503**: 100% of published posts and 0 drafts appear in the RSS and JSON feeds.
- **SC-504**: Every generated draft names no author from the story records, and every short post is within its network's limit.

## Assumptions

- A reader's look in browser storage is a preference, not personal data under REQ-012; both partners confirm this at approval.
- Rule-written drafts are enough to start from; a model-written draft would follow REQ-034's two-model rules and is not part of this spec.
- The feeds are public like the journal itself.

## Out of Scope

- A colour accent or brand palette (both partners decide).
- Posting to any network, scheduling posts, email sending.
- Changing the shared spec's REQ-001..REQ-020.
