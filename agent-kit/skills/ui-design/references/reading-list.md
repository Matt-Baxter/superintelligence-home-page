# Reading list: craft, type, themes, density and taste

Read on 2026-11-11 and checked against this repo. Each line is our paraphrase of the source's advice, not a quote; follow the link before relying on a number. What this repo already does and what it changed is in [docs/DESIGN_REFERENCES.md](../../../../docs/DESIGN_REFERENCES.md) ("Reading list, 2026-11-11").

## Interface craft

- **[Details that make interfaces feel better](https://jakub.kr/writing/details-that-make-interfaces-feel-better)** (Jakub Krehel). `text-wrap: balance` on headings and `pretty` on paragraphs; `tabular-nums` on numbers that change; concentric radii (outer = inner + padding); exits quieter than entrances; optical alignment of icons in the SVG itself.
- **[Invisible Details of Interaction Design](https://rauno.me/craft/interaction-design)** (Rauno Freiberg, 2023). No motion on high-frequency keyboard and menu actions; an interrupted animation reverses at once; a new view grows out of the thing that opened it.
- **[Web Interface Guidelines](https://vercel.com/design/guidelines)** (Vercel, living list). `:focus-visible`, never hidden under sticky bars; 24 px targets (44 px on phones); inputs at 16 px or more on phones; never `transition: all`; `color-scheme` and a `theme-color` meta matching the page; `content-visibility: auto` on long lists; curly quotes, `…`, a non-breaking space between a number and its unit; `scroll-margin-top` under a sticky header; loading states that wait about 150-300 ms and then stay at least 300-500 ms; filters and pages kept in the URL.
- **[UI Density](https://mattstromawn.com/writing/ui-density/)** (Matt Ström-Awn, 2024). Density is value per screen and per second, not the number of things: no animation under about 100 ms, a transition up to 1 s, an indeterminate loader to 10 s, real progress beyond; group by proximity, drop non-data ink, keep the whitespace that carries meaning.

## Type and editorial layout

- **[Practical Typography, key rules](https://practicaltypography.com/summary-of-key-rules.html)** (Matthew Butterick). Body 15-25 px on screens; line height 120-145%; 45-90 characters a line; bold or italic, never both; caps and small caps tracked 5-12%; paragraph indent or space, not both.
- **[Editorial design principles that still matter in 2026](https://www.toastdesign.co.uk/design-resources/editorial-design-principles-2026/)** (Toast Design, 2026). A flexible grid so varied layouts still feel related; named type roles set before typesetting; about 66 characters for long reading; survive readers' own text-spacing overrides (WCAG 1.4.12); never colour alone for categories; short items compact, features given room.

## Themes

- **[Inclusive Dark Mode](https://www.smashingmagazine.com/2025/04/inclusive-dark-mode-designing-accessible-dark-themes/)** (Smashing Magazine, 2025). Dark grey rather than pure black (around `#121212`); 4.5:1 for text and controls; no thin type on dark; the same markup in every theme; follow the system by default, let readers override and remember it; switch without a flash.

## Modern CSS (what is safe to use)

- **[Modern CSS in 2026: what actually shipped](https://cssdna.com/blog/modern-css-2026/)** (CSS DNA, 2026; a vendor's blog, check support on caniuse or MDN before relying on it). Widely available: `:has()`, container queries, nesting, `aspect-ratio`, subgrid, `clamp()`, `:is()`/`:where()`, `@layer`, `oklch()`. Newly available, so guard with `@supports`: anchor positioning, `@starting-style`. Chromium only, so enhancement at most: scroll-driven animations, cross-document view transitions.

## Taste

- **[Taste for Makers](https://paulgraham.com/taste.html)** (Paul Graham, 2002). Good design is simple, solves the right problem, is often a redesign and borrows from good work; taste improves by asking why you like what you like.
- **[Taste Is the New Bottleneck](https://www.designative.info/2026/02/01/taste-is-the-new-bottleneck-design-strategy-and-judgment-in-the-age-of-agents-and-vibe-coding/)** (Itamar Medeiros, 2026). When agents make building cheap, judgment is the scarce part: write down what "good enough" means before delegating, compare alternatives side by side and say why one is stronger, keep standards inspectable and revisit them.
- **[How to Build Your UI Taste](https://supercharge.design/articles/how-to-build-your-ui-taste-as-a-designer)** (Supercharge Design, 2025). Notice what stops you, name why it works, look outside UI, practise redesigns, ask for critique.

## For this repo, in one line each

1. Before an agent builds a page, write its "good enough" in the task (who reads it, the one job it does, what must be visible on a phone).
2. Ask for two versions of anything visual and pick one side by side, saying why; record the why in DESIGN_REFERENCES.
3. Keep each theme a token set only, checked by `scripts/unslop.js`; the accent stays ink until both partners choose a colour.
4. Prefer a CSS feature that is widely available; anything newer is an enhancement behind `@supports`.
