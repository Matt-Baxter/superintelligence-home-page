import { z } from "zod";
import { tone } from "../_shared.mjs";
export default {
  name: "Metric",
  description: "A single headline number with a label.",
  props: z.object({ label: z.string(), value: z.string(), hint: z.string().optional(), tone: tone.optional() }),
};
