import { z } from "zod";

export default {
  name: "Grid",
  description: "Responsive grid; collapses to one column on phones.",
  props: z.object({ columns: z.number().int().min(1).max(4) }),
};
