import { z } from "zod";

export default {
  name: "Stack",
  description: "Lays out children in a column (default) or a row.",
  props: z.object({
        direction: z.enum(["vertical", "horizontal"]).optional(),
        gap: z.enum(["sm", "md", "lg"]).optional(),
        wrap: z.boolean().optional(),
      }),
};
