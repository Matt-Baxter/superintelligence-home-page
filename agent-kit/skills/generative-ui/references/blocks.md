# Writing a block

```js
// modules/<id>/blocks/Sparkline/block.mjs  (headless: server, catalog prompt, validation)
import { z } from "zod";
export default {
  name: "Sparkline",                       // must equal the folder name; global across modules
  description: "A small line of values over time with a label and the latest value. Use for weekly counts.",
  props: z.object({ label: z.string(), values: z.array(z.number()).max(52), display: z.string().optional() }),
};
```
```jsx
// modules/<id>/blocks/Sparkline/render.jsx  (browser only)
import React from "react";
export default ({ props, children, emit }) => <div className="jr-spark">…</div>;
```

Rules:
- Props are data, not markup: strings, numbers, booleans, small arrays. No HTML strings, no URLs that run script (`javascript:`); links to feeds use `rel="noopener noreferrer"`.
- The description says what the block shows and when to use it; it becomes part of the LLM prompt.
- Interactive blocks call `emit("<event>")`; specs bind events to catalog actions (`openStory`, `filterTopic`, `copyText`, `navigate`). New actions go in `views/actions.mjs` and `jrHandlers` in `public/js/api.js` (core change).
- Don't import another module's files (define small helpers like `tone` locally).
- Style with `app.css` tokens (`--accent`, `--line`, …) so dark mode works; add CSS to `public/css/app.css` under a `jr-<name>` class.
- Existing blocks to reuse first: Stack, Grid, Card, Heading, Text, Metric, Badge, BarList, Table, Callout, Quote, Button, Divider, StoryRow (blocks-core), Scorecard, Verdict (decision).
