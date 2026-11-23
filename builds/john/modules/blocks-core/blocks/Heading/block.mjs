import { z } from "zod";

export default {
  name: "Heading",
  description: "Section heading.",
  props: z.object({ text: z.string(), level: z.enum(["2", "3"]).optional() }),
};
