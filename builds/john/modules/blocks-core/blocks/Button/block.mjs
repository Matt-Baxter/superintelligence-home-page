import { z } from "zod";

export default {
  name: "Button",
  description: "A button. Bind its 'press' event to an action with the element's `on` field.",
  props: z.object({ label: z.string(), variant: z.enum(["primary", "secondary"]).optional() }),
};
