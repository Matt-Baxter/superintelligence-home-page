import { z } from "zod";

export default {
  name: "Text",
  description: "A paragraph of plain text.",
  props: z.object({ text: z.string(), tone: z.enum(["default", "muted"]).optional(), size: z.enum(["sm", "md"]).optional() }),
};
