import { z } from "zod";

export default {
  name: "Scorecard",
  description: "Entries compared on weighted criteria: one row per entry with its 0-10 score per criterion and a 0-100 weighted total; the leader is highlighted.",
  props: z.object({
    criteria: z.array(z.object({ label: z.string(), weight: z.number() })),
    entries: z.array(z.object({ label: z.string(), total: z.number(), scores: z.array(z.number().nullable()), leader: z.boolean().optional() })),
    caption: z.string().optional(),
  }),
};
