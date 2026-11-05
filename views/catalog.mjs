// The json-render catalog: the only components and actions a view spec may use.
// Shared by the server (to validate specs it builds, and to expose catalog.prompt() for AI)
// and the browser bundle (which maps each component to a React implementation).
import { defineCatalog } from "@json-render/core";
import { schema } from "@json-render/react/schema";
import { z } from "zod";

const tone = z.enum(["neutral", "accent", "good", "warn", "bad"]);

export const catalog = defineCatalog(schema, {
  components: {
    Stack: {
      props: z.object({
        direction: z.enum(["vertical", "horizontal"]).optional(),
        gap: z.enum(["sm", "md", "lg"]).optional(),
        wrap: z.boolean().optional(),
      }),
      description: "Lays out children in a column (default) or a row.",
    },
    Grid: {
      props: z.object({ columns: z.number().int().min(1).max(4) }),
      description: "Responsive grid; collapses to one column on phones.",
    },
    Card: {
      props: z.object({ title: z.string().optional(), subtitle: z.string().optional(), tone: tone.optional() }),
      description: "A bordered panel that groups related content.",
    },
    Heading: {
      props: z.object({ text: z.string(), level: z.enum(["2", "3"]).optional() }),
      description: "Section heading.",
    },
    Text: {
      props: z.object({ text: z.string(), tone: z.enum(["default", "muted"]).optional(), size: z.enum(["sm", "md"]).optional() }),
      description: "A paragraph of plain text.",
    },
    Metric: {
      props: z.object({ label: z.string(), value: z.string(), hint: z.string().optional(), tone: tone.optional() }),
      description: "A single headline number with a label.",
    },
    Badge: {
      props: z.object({ text: z.string(), tone: tone.optional() }),
      description: "Small status pill.",
    },
    BarList: {
      props: z.object({
        items: z.array(z.object({
          label: z.string(), value: z.number(), max: z.number(), display: z.string(),
          hint: z.string().optional(), highlight: z.boolean().optional(),
        })),
      }),
      description: "Ranked horizontal bars, e.g. stories per topic.",
    },
    Table: {
      props: z.object({ columns: z.array(z.string()), rows: z.array(z.array(z.string())), caption: z.string().optional() }),
      description: "A simple data table of strings.",
    },
    Callout: {
      props: z.object({ tone: tone, title: z.string(), text: z.string().optional() }),
      description: "Highlighted note, warning or success message.",
    },
    Quote: {
      props: z.object({ text: z.string(), source: z.string().optional() }),
      description: "A quoted excerpt, e.g. from a paper abstract.",
    },
    Button: {
      props: z.object({ label: z.string(), variant: z.enum(["primary", "secondary"]).optional() }),
      description: "A button. Bind its 'press' event to an action with the element's `on` field.",
    },
    Divider: { props: z.object({}), description: "Horizontal rule." },
    StoryRow: {
      props: z.object({ id: z.number(), title: z.string(), url: z.string(), meta: z.string(), topics: z.array(z.string()), sources: z.number(), votes: z.number() }),
      description: "One story in a ranked list: title linking out, a meta line, topic chips, and how many sources covered it. Bind 'open' to openStory.",
    },
  },
  actions: {
    openStory: { params: z.object({ id: z.number() }), description: "Open a story's page." },
    filterTopic: { params: z.object({ topic: z.string() }), description: "Show the feed filtered to one ontology topic." },
    copyText: { params: z.object({ text: z.string() }), description: "Copy text to the clipboard." },
    navigate: { params: z.object({ href: z.string() }), description: "Go to another page in the app." },
  },
});
