# Slop gates

`scripts/unslop.js` checks pages (`public/**/*.html`, `modules/*/pages/*.html`), styles (`public/css/*.css`) and json-render blocks (`modules/*/blocks/**/render.jsx`). An **error** fails preflight. A **warn** is printed for a person to judge.

| Gate | Level | Why |
| --- | --- | --- |
| `transition: all` | error | It animates layout properties by accident and is slow. Name the properties instead. |
| Bounce easing (a `cubic-bezier` whose y values go above 1 or below 0) | error | Rule 13: no bounce on everyday UI. |
| `scale(0)` in a transition or keyframe | error | Rule 10: start at 0.95. |
| Animation or transition longer than 400 ms | error | Everyday UI should never make people wait. |
| Animations with no `prefers-reduced-motion` handling in the same file (or app.css) | error | Accessibility. |
| Purple, violet or indigo gradient (`linear-gradient` with hues roughly 250-290°) | error | It's the signature AI-slop look. |
| Gradient text (`background-clip: text`) | error | It's decorative and hard to read. |
| Buzzword copy (unlock, supercharge, seamless, elevate, revolutionize, cutting-edge, game-changer, "dive in", "fast-paced world", "harness the power") | error | Plain words (rule 5 of the skill). |
| Emoji used as an icon inside a heading, button or nav link | warn | Use text, or a real icon with a label. |
| A hard-coded colour in a page's `<style>` that isn't a token (`#hex`, `rgb(`) | warn | Use the tokens, so dark mode works. |
| `ease-in` used on an entrance (`.enter`, `open`, `show` or `in` keyframes) | warn | Rule 1. |
| `box-shadow` with blur over 40 px | warn | It gives a glassy, floating look. Keep shadows for menus. |
| Text contrast under 4.5:1 for a text token pair (`--fg`, `--muted`, `--warn`, `--accent` on their backgrounds), light or dark | error | Readability (WCAG AA). |
| Headings without `text-wrap: balance` in a stylesheet that defines the tokens | error | Long titles break with one word on the last line. |
| No `tabular-nums` in a stylesheet that defines the tokens | warn | Numbers in columns jiggle. |
| Filler badge (`badge`, `pill` or `chip` saying New, Beta, Hot, Pro, AI-powered, Featured, Trending...) | warn | Badges must carry information. |
| Sparkle, fire or rocket glyph in page text | warn | Embellishment. |
| Italic word inside a heading, button or nav; `font-style: italic` outside quotes, titles, terms or notes | warn | Random italics read as decoration. |
| Monospace on body text, headings, labels or buttons | warn | Mono is for code, ids and aligned numbers. |
| Generic `h1` (Welcome, Dashboard, Overview, Home, Get started) | warn | Headlines say what the page is for. |
| A label that its placeholder repeats word for word | warn | Redundant label: make the placeholder an example. |
| More than one `btn primary` in a page | warn | One primary action per view. Mark buttons in views that never show together `unslop-ok`. |
| A page that loads data with raw `fetch()` and shows no loading state | warn | Pages using `api()` get the shared one (aria-busy and a progress line). |
| Drawn (SVG) and emoji icons on one page | warn | One icon style. |

To allow one deliberate exception, put `/* unslop-ok: reason */` (or `<!-- unslop-ok: reason -->`) on the same line. The reason is required.
