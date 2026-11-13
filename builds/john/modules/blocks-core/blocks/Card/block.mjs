import { z } from "zod";
import { tone } from "../_shared.mjs";
export default {
  name: "Card",
  description: "A bordered panel that groups related content.",
  props: z.object({ title: z.string().optional(), subtitle: z.string().optional(), tone: tone.optional() }),
};
