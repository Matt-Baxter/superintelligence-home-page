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

To allow one deliberate exception, put `/* unslop-ok: reason */` (or `<!-- unslop-ok: reason -->`) on the same line. The reason is required.
