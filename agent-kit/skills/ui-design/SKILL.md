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
7. **Run the check.** `node scripts/unslop.js` (also part of preflight) scans pages, styles and blocks for the slop patterns in `references/slop-gates.md`. Errors fail preflight. Warnings are things to look at.
8. **Look at it.** Take a screenshot at 1280 px and at 390 px in light and dark (`test/e2e.js` already shoots the main pages into `shots/`). Then ask: would a careful human designer have made each choice on purpose?

Load `references/motion.md` when adding any animation, `references/slop-gates.md` when the check fails or for a full review, and `references/external-skills.md` when the humans want to install more design skills.

## Project references

[Design references](../../../docs/DESIGN_REFERENCES.md) records source links, the patterns actually applied, their requirements and verification. Consult it for related work and preserve the existing visual system.
