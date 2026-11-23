// Actions a json-render spec may trigger. The browser maps each to a handler (jrHandlers in public/js/api.js).
import { z } from "zod";

export const actions = {
  openStory: { params: z.object({ id: z.number() }), description: "Open a story's page." },
  filterTopic: { params: z.object({ topic: z.string() }), description: "Show the feed filtered to one ontology topic." },
  copyText: { params: z.object({ text: z.string() }), description: "Copy text to the clipboard." },
  navigate: { params: z.object({ href: z.string() }), description: "Go to another page in the app." },
};
