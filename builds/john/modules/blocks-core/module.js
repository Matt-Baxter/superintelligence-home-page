// Core json-render blocks (layout, text, metrics, tables, story rows). Blocks are found in blocks/<Name>/:
// block.mjs (props schema + description, headless) and render.jsx (React view, bundled by `npm run build`).
module.exports = {
  id: "blocks-core",
  version: "1.0.0",
  description: "Core generative-UI blocks for json-render: Stack, Grid, Card, Heading, Text, Metric, Badge, BarList, Table, Callout, Quote, Button, Divider, StoryRow.",
};
