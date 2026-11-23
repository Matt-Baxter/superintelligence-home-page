import { z } from "zod";

export default {
  name: "BarList",
  description: "Ranked horizontal bars, e.g. stories per topic.",
  props: z.object({
        items: z.array(z.object({
          label: z.string(), value: z.number(), max: z.number(), display: z.string(),
          hint: z.string().optional(), highlight: z.boolean().optional(),
        })),
      }),
};
