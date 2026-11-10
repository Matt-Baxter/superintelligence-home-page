import { z } from "zod";
export default {
  name: "Ladder",
  description: "An ordered rating scale with the current step filled, e.g. evidence 'none yet, thin, early, some support' or buzz 'quiet, some, loud'. Bind `value` to state to move it.",
  props: z.object({ label: z.string().optional(), levels: z.array(z.string()).min(2), value: z.string(), hint: z.string().optional() }),
};
