import { z } from "zod";

export default {
  name: "Table",
  description: "A simple data table of strings.",
  props: z.object({ columns: z.array(z.string()), rows: z.array(z.array(z.string())), caption: z.string().optional() }),
};
