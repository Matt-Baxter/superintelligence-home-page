import { z } from "zod";
import { tone } from "../_shared.mjs";
export default {
  name: "Badge",
  description: "Small status pill.",
  props: z.object({ text: z.string(), tone: tone.optional() }),
};
