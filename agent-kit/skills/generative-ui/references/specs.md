# Spec patterns

```json
{ "root": "stack-1", "elements": {
  "stack-1":   { "type": "Stack", "props": { "gap": "md" }, "children": ["grid-1", "card-1"] },
  "grid-1":    { "type": "Grid", "props": { "columns": 3 }, "children": ["metric-1"] },
  "metric-1":  { "type": "Metric", "props": { "label": "Stories this week", "value": "42" }, "children": [] },
  "card-1":    { "type": "Card", "props": { "title": "Top stories" }, "children": ["story-1", "button-1"] },
  "story-1":   { "type": "StoryRow", "props": { "id": 7, "title": "…", "url": "https://…", "meta": "…", "topics": [], "sources": 2, "votes": 3 }, "children": [],
                 "on": { "open": { "action": "openStory", "params": { "id": 7 } } } },
  "button-1":  { "type": "Button", "props": { "label": "All agent stories" }, "children": [],
                 "on": { "press": { "action": "filterTopic", "params": { "topic": "agents" } } } }
} }
```

- Every element needs `type`, `props` and `children` (use `[]`). Every child id must exist; the root must exist. Ids just need to be unique (`type-n` is the convention used by builders).
- Values are strings where the block says string (`"value": "42"`, not `42`).
- Grids collapse to one or two columns on phones; don't use more than 4 columns.
- Empty data: render a `Callout` (tone `neutral`) that says what will appear and when, never an empty Card.
- Numbers come from queries or the user's data. A generated view must not invent figures, quotes or claims about real people; label sample content "(test data)".
- Builders in code: the `el(type, props, children, extra)` helper pattern in `modules/capabilities/view.js` and `views/specs.mjs`; `check(spec)` from `views/specs.mjs` throws on invalid specs.
