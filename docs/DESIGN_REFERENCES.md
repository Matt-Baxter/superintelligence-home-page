# Interface references

## Details inspiration, 2026-11-07

Reference: [Details Inspo](https://www.details.so/inspo), [navigation examples](https://www.details.so/inspo/category/navigation). Reviewed the public library and its compact navigation, editorial type hierarchy, category controls and restrained spacing. The site is a source of composition ideas; no source code, artwork or paid components were copied.

Applied to the research control room (`modules/research/pages/control.html`), serving proposed REQ-030 and responsive REQ-018:

| Pattern | Application |
| --- | --- |
| Persistent local navigation | A desktop section rail with queue counts; a horizontally scrollable section strip on phones |
| Clear action hierarchy | Review desk and Specs actions next to a short working title |
| Progressive disclosure | Setup details, each proposed spec and people checks expand independently; hidden settings never imply a live model connection |
| Editorial spacing | Quiet count row and ruled task sections, using the existing monochrome tokens and typefaces |
| Small interaction feedback | Active section indicator, token-based hover, native keyboard disclosures and confirmed save messages |

Reuse where there is a matching user task. Keep primary tasks visible, make empty states actionable, retain keyboard access and reduced-motion behavior, and test phone widths and both themes. Prefer the existing shared style tokens to introducing a second visual system. Do not apply marketing-style heroes or scroll effects to routine research work.

Verification lives in `test/e2e.js`, “Research control room (REQ-030, REQ-018)”. Screenshots: `shots/control-{light,dark}-{1280,390}.png`.

Validation on the revised interface: `Preflight passed.`; `214 passed, 0 failed`; `page errors: none`; `unslop: 38 files, 0 error(s), 0 warning(s)`. The browser suite uses synthetic test data and covers both themes at 390px and 1280px, keyboard disclosures, save feedback, access checks and anchor visibility.

## Reader workspace, 2026-11-07

Applied the same compact navigation and progressive-disclosure ideas to the existing feed, serving REQ-002, REQ-014, REQ-017 and REQ-018. Search and sort remain visible on phones; source, date and saved filters expand on demand. A short mobile brand, two-column menu, horizontal topic strip and 44px action targets leave more room for reading. Desktop navigation retains a separate administration menu. Both themes use the existing tokens and typefaces.

Filters are restored from the URL and browser Back; clear filters returns to newest stories from the last week. Loading states announce progress. Failed requests preserve prior stories and offer retry. Cancellation and request ordering prevent older searches replacing current results. Pagination cannot append a different filter to old results. Votes and saves wait for confirmation, prevent repeated pending clicks and display failures. Removing saved stories updates the list immediately after confirmation; an emptied paginated page retains a useful load-more path. Startup failures have a visible retry screen. Keyboard support includes a skip link, Escape and focus return for navigation and submission.

Verification: `test/e2e.js`, “Reader robustness (REQ-002, REQ-014, REQ-017, REQ-018)”, exercises URL state, delayed responses, injected failures, duplicate clicks, pagination, startup recovery and 320/390/768/1280px layouts in both themes. Screenshots: `shots/reader-{light,dark}-{390,1280}.png`. All data is synthetic. These changes retain existing routes and response shapes; proposed spec 004 capabilities still await T000 approval.

Final reader validation: `Preflight passed.`; `262 passed, 0 failed`; `page errors: none`. Browser checks ran against throwaway SQLite fixtures. Independent review found no remaining concrete blockers after the pagination fixes. No database code changed in this pass.

## Public orientation and sign-in, 2026-11-07

REQ-009–012 and REQ-018: the sign-in form now explains account requirements, supports password visibility and password managers, preserves retry state, and describes the local return destination. The public `/welcome` page uses a short section navigation, ruled sample stories and plain explanations of source grouping and significance. Samples are explicitly synthetic. Local demo role controls appear only in the disposable demo runner. See [access testing](TESTING_ACCESS.md) for use and validation.

Public reading follow-up: the actual feed now opens at `/` without an account. Guest navigation contains Feed, About and Sign in. Read-story actions expose source explanations; vote/save actions preserve a return link through sign-in. Account editors and admin navigation remain hidden for guests, with server authorization still enforced. `/welcome` remains the orientation page.

## Reading quality and evidence visualization, 2026-11-07

REQ-002, REQ-007, REQ-017 and REQ-018: compact feed controls now apply through 900px, including short intermediate-width windows. Individual applied-filter controls preserve the remaining selection. Empty states offer Clear search and Search any time rather than sending guests into authenticated sources administration. Result counts distinguish an exhausted query from an empty saved page with more available.

A keyboard/touch score button opens the existing factor breakdown inline. Native meters show each factor's actual points on the same 0–100 scale, with text equivalents and a clear rule-based-significance disclaimer. They are not confidence estimates. Factor markup is created only when requested; opening it makes no extra API request. The story page has a real primary heading, an explicit original-source action and Back to results. Return URLs retain filters, the originating page offset and story anchor; a later-page view has a first-results escape.

Motion uses existing entrance and opacity tokens under `prefers-reduced-motion: no-preference`. Reduced motion has no evidence/menu entrance animation. Feed rendering batches cards through a DocumentFragment; unrelated filter changes retain topic navigation nodes. These are bounded rendering improvements, not a claim of measured production speedup. No scoring, server routes, response shapes or database code changed.

Browser coverage lives in `test/e2e.js`, “Reading quality”. Screenshots: `shots/quality-{light,dark}-{390,676,1280}.png`. The local fixture data is synthetic. New proposed spec 004 capabilities remain gated by T000.

Validation: `Preflight passed.`; full browser suite `306 passed, 0 failed`, `page errors: none`. A focused short-window check at 676×504 in both themes confirmed the complete first title ended at 456px, within the viewport. Inline evidence made zero additional API requests in the regression check. Screenshots and synthetic fixtures support local verification, not production performance or accessibility certification.

Demo-role regression after this pass: `24 passed, 0 failed`; guest, reader and admin at 390px/1280px in light/dark, `page errors: none`.

## Research wave 1, 2026-11-07

Implemented research ideas 1, 5, 6, 8, 11 and 19 under REQ-002, REQ-014, REQ-017 and REQ-018. Guest navigation exposes Feed and About directly at narrow widths. Signed-in navigation has a Saved destination with all-time saves and correct active state. Topic changes preserve search, source, date, saved state and sort; the selected topic scrolls within its own strip without taking focus. Sort help explains the four existing orders and time window without changing ranking rules.

Story dates disclose publication or first-seen time in UTC. Date-only values retain their actual precision and explicitly say the time is unavailable; invalid dates do not fabricate a value. Native date disclosures support keyboard access and Escape. The 320px evidence chart now stacks labels and meters to prevent overflow.

Validation: `324 passed, 0 failed`, `page errors: none` in the full browser suite; `UI dates: 6 passed, 0 failed.` The existing failure-recovery test now waits for a completed filter reset before taking its reference results, avoiding comparison against a request still in flight. No API, authentication, database or scoring contract changed. Remaining research ideas keep their original review gates.

Research wave 1 final gates: `Preflight passed.`; demo emulations `24 passed, 0 failed`, `page errors: none`. New snapshots: `shots/wave1-feed-{light,dark}-1280.png` and `shots/quality-{light,dark}-320.png`.

Connected CMS pass (2026-11-07): shared token-based breadcrumbs, a role-filtered page directory, source/evidence links and two-column content/editor workspaces. Phone layouts stack panels and bound record-list height; the feed directory reuses its results row to preserve short-viewport reading. Original-post preview and public reading share plain-text typography. Verified at 390/1280 pixels in light/dark, with a held-save regression protecting editor text. See `test/cms-e2e.js` and `shots/cms-editorial-demo.png`.

Term-pointer pass (2026-11-07): dotted inline definition links preserve reading text, source links stay explicit, and notation pointers unpack formulas without introducing a new rendering dependency. Existing typography/tokens style function properties and a bounded numerical explorer. Keyboard hash navigation focuses the selected entry; search filters recover the target of related pointers. Tested at 390/1280 pixels in light/dark and against dynamically replaced content. See `test/terms-e2e.js`.

## Reading list, 2026-11-11

Ten articles on interface craft, typography, dark themes, density, modern CSS and taste, read and checked against this build. Sources, with our paraphrase of each one's advice: [`agent-kit/skills/ui-design/references/reading-list.md`](../agent-kit/skills/ui-design/references/reading-list.md). Serves REQ-018 (every page usable on a phone and readable) and proposed REQ-053 (themes and layouts).

**Already true here** (checked in the code): balanced headings and pretty paragraphs; `tabular-nums` on changing numbers; `:focus-visible` rings; 44 px targets on phones; 16 px inputs; no `transition: all`; reduced motion honoured; loading line after 150 ms; filters and pages in the URL; `scroll-margin-top` under the sticky bar; 4.5:1 contrast in every theme (checked by `scripts/unslop.js`); status never by colour alone; system theme by default with a reader override that is remembered (REQ-053).

**Changed in this pass**:

| Advice | Source | Change |
| --- | --- | --- |
| Dark grey, not pure black | Smashing Magazine | Dark `--bg` `#0e0e0e` → `#121212`, `--surface` `#171717` → `#1a1a1a` (contrast still checked) |
| `theme-color` matches the page | Vercel guidelines | `themeColor()` in `public/js/api.js` sets the meta from `--bg` on load, on theme change and when the system scheme flips |
| `content-visibility` on long lists | Vercel guidelines | Feed stories off screen skip layout and paint, with an intrinsic size so the scrollbar stays steady |
| Components adapt to their own width | CSS DNA (container queries) | Each story is a size container; in a narrow card the title steps down and the actions stack |
| About 66 characters for long reading | Butterick; Toast Design | Journal paragraphs at 68ch |
| Survive readers' text-spacing overrides | Toast Design (WCAG 1.4.12) | Browser test applies the WCAG spacing at 390 px on the feed, a story and the journal and checks for sideways scroll |

**Left for a person to decide**: curly quotes and apostrophes in interface copy (most strings use straight ones; a sweep touches every page); a colour accent or `oklch()` palette (both partners); a reading-progress bar or cross-document view transitions (Chromium only today, so enhancement at most); writing a short "good enough" for each page before an agent builds it, and comparing two versions side by side (from the taste essays; a working habit, not code).
