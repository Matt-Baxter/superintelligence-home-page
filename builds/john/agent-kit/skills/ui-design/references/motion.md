# Motion rules

These are the twenty rules from the "beautiful animations" list John shared, written as this repo applies them. Motion should explain where something came from and where it went. It should never be decoration.

## Tokens (in `:root`, `public/css/app.css`)

| Token | Value | Use |
| --- | --- | --- |
| `--ease-out` | `cubic-bezier(.23, 1, .32, 1)` | Entrances: menus, drawers, toasts, rows |
| `--ease-in-out` | `cubic-bezier(.77, 0, .175, 1)` | Things moving from one place to another on screen |
| `--ease-in` | `cubic-bezier(.55, .055, .675, .19)` | Exits only |
| `--dur-1` | `150ms` | Press feedback, hover, small fades |
| `--dur-2` | `200ms` | Dropdowns, popovers |
| `--dur-3` | `250ms` | Drawers and larger panels |
| `--dur-exit` | `160ms` | Exits (about 20% shorter than `--dur-2`) |

## Ready classes

| Class | What it does |
| --- | --- |
| `.enter` | Fades in and rises 4px with `--ease-out`. Use it for anything that appears. |
| `.pop` | Popover or menu: grows from 0.95 to 1 with its `transform-origin` at the trigger. |
| `.stagger > *` | Rows come in 30 ms apart. Set `style="--i: n"` on each row; it stops after 10 rows. |
| `.pulse` | One soft ring that confirms a success (saved, voted, copied). |
| `.btn:active`, `button:active` | Scale to 0.97. |

## The 20 rules

1. **Ease-out for entrances.** Things arrive fast and settle; ease-in feels sluggish.
2. **Dropdowns at 150-250 ms.** Anything slower feels like waiting.
3. **Stagger list rows by 30 ms.** Cap it at about 10 rows, so a long list never waits.
4. **Scale to 0.97 on press.** It is instant tactile feedback. Don't go lower.
5. **Stretch moving knobs about 12%.** A toggle or slider knob stretches a little along its path while it moves.
6. **Stagger as details settle.** The container arrives first, then its details (title, then meta).
7. **Arcs for object movement.** Something travelling across the screen follows a slight curve, not a dead-straight line.
8. **Pulse to confirm success.** Use one pulse, not a loop.
9. **Ease-in-out for moves.** Anything already on screen that moves (re-order, a drag that snaps back) accelerates and decelerates.
10. **Start popovers at 0.95.** Don't start at 0: growing from nothing looks cheap.
11. **Enter from the trigger.** Set `transform-origin` toward the button that opened the thing.
12. **Exit to the trigger.** It closes back toward where it came from.
13. **No bounce on everyday UI.** Keep overshoot springs for playful or game moments. Never use them for menus, forms or lists.
14. **Don't tween while held.** While the user drags or holds, the element follows the pointer 1:1, with no transition. Animate only on release (the timeline bars do this).
15. **Make exits about 20% shorter.** People have already moved on.
16. **Overlap the old and new states.** Crossfade instead of hiding one and then showing the other, so nothing flashes empty.
17. **Masks for reveals and colour.** Reveal with `clip-path` or a mask instead of sliding whole blocks around.
18. **Crossfade icons with a little blur.** When an icon swaps (copy → check), fade both and blur 2px across the swap.
19. **Rubber-band past bounds.** Dragging past an edge resists, moving about a third of the pointer's distance, then springs back.
20. **Reuse the same layout identity.** When an item moves between views (a card opening into a drawer), animate the same element, or a FLIP of it. Don't animate two unrelated ones.

## Always

- Wrap motion in `@media (prefers-reduced-motion: no-preference)`, or turn it off under `reduce`. app.css already turns off every token-based animation under `reduce`.
- Animate only `transform` and `opacity` (plus `clip-path` and `filter` for reveals). Never animate `width`, `height`, `top` or `left` on lists.
- Never use `transition: all`.
