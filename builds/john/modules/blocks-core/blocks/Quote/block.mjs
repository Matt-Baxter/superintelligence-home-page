import { z } from "zod";

export default {
  name: "Quote",
  description: "A quoted excerpt, e.g. from a paper abstract.",
  props: z.object({ text: z.string(), source: z.string().optional() }),
};
