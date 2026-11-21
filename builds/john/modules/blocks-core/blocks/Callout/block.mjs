import { z } from "zod";
import { tone } from "../_shared.mjs";
export default {
  name: "Callout",
  description: "Highlighted note, warning or success message.",
  props: z.object({ tone: tone, title: z.string(), text: z.string().optional() }),
};
