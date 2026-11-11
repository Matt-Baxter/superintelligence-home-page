---
name: ui-design
description: Design and review UI so it reads as deliberate rather than AI-generated ("unslop"): layout, type, colour, copy and motion rules for this repo's plain HTML pages, plus the unslop check that preflight runs. Use when building or restyling a page, adding an animation or transition, or when asked to "unslop", polish or review the UI.
---

# UI design without slop

"Slop" is the generic look an AI produces when nobody makes decisions: purple gradients, a centred hero with three feature cards, emoji as icons, glassy shadows on everything, buzzword copy, and motion that bounces or fades for no reason. This repo's look is deliberately quiet: a warm off-white or near-black surface, one ink accent, system fonts, thin rules, and dense, readable lists (a news reader, not a landing page).

1. **Start from the tokens.** Colours, radius and motion come from `:root` in `public/css/app.css` (`--accent`, `--line`, `--ease-out`, `--dur-*`). Never hard-code a new colour or a new duration in a page. If a token is missing, add it to `:root` with a dark-mode value.
2. **Content first.** Make the real data the hero: titles, numbers and sources. No decorative heroes, stock illustrations or "Welcome to…" banners. Empty states say what to do next in one sentence.
3. **One accent, used for meaning.** Use the accent for the current thing, links and the one primary action per view. Good, warn and bad are for status only. No gradients on text or buttons.
4. **Type does the hierarchy.** Use the size steps already in app.css (13 / 14 / 15 / 17 / 20 / 26). Use weight 600 for titles and `tabular-nums` for any number in a column. Don't use all-caps paragraphs or letter-spaced body text.
5. **Copy in plain words.** Write labels as verbs ("Add source", "Save"), and sentences as a person would say them. Banned: unlock, supercharge, seamless, elevate, revolutionize, cutting-edge, game-changer, "dive in", "in today's fast-paced world". `scripts/unslop.js` flags these.
6. **Motion follows `references/motion.md`.** It covers 20 rules. In short:
   - Use ease-out for entrances and ease-in-out for moves.
   - Use 150-250 ms for menus.
   - Make exits about 20% shorter than entrances.
   - Use no bounce on everyday UI.
   - Scale to 0.97 on press.
   - Start popovers at 0.95, coming from their trigger.
   - Stagger rows by 30 ms.
   - Turn everything off under `prefers-reduced-motion`.
   - Use the ready classes (`.enter`, `.pop`, `.stagger`, `.pulse`) instead of writing keyframes.
7. **Details that give AI away.** Each of these is a decision a careful designer makes on purpose:
   - Delete filler badges ("New", "Beta", "AI-powered") and decorative glyphs (sparkles, fire, rockets). A badge must carry information.
   - Drop redundant labels: a label and a placeholder that say the same thing, or a heading that repeats the nav. Make placeholders examples.
   - Italics only for quotes, titles, terms and notes. Never for random words in headings, buttons or nav.
   - Mono (`var(--mono)`) only for code, ids and numbers that must line up. Never for body text, headings or buttons.
   - Headlines say what the page is for ("Sources this site reads", not "Dashboard" or "Welcome"). `h1-h3` use `text-wrap: balance` and body text `pretty`, already set in app.css.
   - One primary button per view. Everything else is a plain `.btn`. Several primary buttons on one page are fine only when they sit in views that never show together; mark those `unslop-ok` with the reason.
   - Show the real product: real data, never a stock illustration. Make the main thing on a view the biggest thing on it, and group by spacing (gap) before borders.
   - Nested rounded boxes: inner radius = outer radius minus the padding between them (0 when the inset is bigger than the radius). Flush children use `overflow: hidden`.
   - One icon style per page: text, or one set of drawn icons. Not both, and not emoji.
   - Text contrast is at least 4.5:1 for every text token pair, light and dark (the check computes it).
   - `tabular-nums` for any number that changes or sits in a column.
   - Every view that loads data shows that it is loading. `api()` in `public/js/api.js` marks the page `aria-busy` and draws a thin progress line after 150 ms; a page using raw `fetch()` shows its own "Loading…".
   - Animate feedback that helps (a saved state, a vote landing, progress), never decoration. Motion rules below.
   - Align by eye: optical alignment (icons, quotes, numbers) beats pixel-equal padding. Check it in the screenshots.
   - The accent is ink (black or white) by design. A colour accent is a decision for both partners, not an agent.
8. **Run the check.** `node scripts/unslop.js` (also part of preflight) scans pages, styles and blocks for the slop patterns in `references/slop-gates.md`. Errors fail preflight. Warnings are things to look at.
9. **Look at it.** Take a screenshot at 1280 px and at 390 px in light and dark (`test/e2e.js` already shoots the main pages into `shots/`). Then ask: would a careful human designer have made each choice on purpose?

Load `references/motion.md` when adding any animation, `references/slop-gates.md` when the check fails or for a full review, `references/reading-list.md` for the articles behind these rules (craft, type, themes, density, modern CSS, taste), and `references/external-skills.md` when the humans want to install more design skills.

## Project references

[Design references](../../../docs/DESIGN_REFERENCES.md) records source links, the patterns actually applied, their requirements and verification. Consult it for related work and preserve the existing visual system.
