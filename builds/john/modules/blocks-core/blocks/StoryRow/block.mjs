import { z } from "zod";

export default {
  name: "StoryRow",
  description: "One story in a ranked list: title linking out, a meta line, topic chips, and how many sources covered it. Bind 'open' to openStory.",
  props: z.object({ id: z.number(), title: z.string(), url: z.string(), meta: z.string(), topics: z.array(z.string()), sources: z.number(), votes: z.number() }),
};
