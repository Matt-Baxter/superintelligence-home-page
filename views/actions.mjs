// Actions a json-render spec may trigger. The browser maps each to a handler (jrHandlers in public/js/api.js).
import { z } from "zod";

export const actions = {
  openStory: { params: z.object({ id: z.number() }), description: "Open a story's page." },
  filterTopic: { params: z.object({ topic: z.string() }), description: "Show the feed filtered to one ontology topic." },
  copyText: { params: z.object({ text: z.string() }), description: "Copy text to the clipboard." },
  navigate: { params: z.object({ href: z.string() }), description: "Go to another page in the app." },
  // Data layer (REQ-064, proposed): run a named action (POST /api/data/actions/:id) as the viewer, then re-resolve the
  // spec's bindings; or just re-resolve them.
  runAction: { params: z.object({ id: z.string(), input: z.record(z.string(), z.any()).optional() }), description: "Run a named data action with its input (the server checks permission and input, and audits it), then refresh the view's bindings." },
  refresh: { params: z.object({}).optional(), description: "Re-run the view's bindings and redraw it with fresh data." },
};
