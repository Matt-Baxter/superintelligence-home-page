# blocks-core

The core json-render blocks every view can use: Stack, Grid, Card, Heading, Text, Metric, Badge, BarList, Table, Callout, Quote, Button, Divider, StoryRow.

- **Extension point**: contributes to `ui.blocks` by folder: `blocks/<Name>/block.mjs` (zod props + description, headless, read by the server catalog and by LLM prompts) and `blocks/<Name>/render.jsx` (React view, bundled by `npm run build`).
- **Shared helpers**: `blocks/_shared.mjs` (`tone`), `blocks/_shared.jsx` (`cx`). Other modules define their own instead of importing these.
