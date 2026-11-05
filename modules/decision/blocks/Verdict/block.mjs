import { z } from "zod";
const tone = z.enum(["neutral", "accent", "good", "warn", "bad"]); // modules don't import each other's files

export default {
  name: "Verdict",
  description: "A decision's outcome: which judge ran, its recommendation and reason, whether an external judge agrees with the transparent totals, and open warnings to resolve before signing off.",
  props: z.object({
    judge: z.string(), method: z.enum(["builtin", "external"]), title: z.string(),
    recommendation: z.string(), reason: z.string(), tone: tone.optional(),
    agreement: z.string().optional(), warnings: z.array(z.string()).optional(),
  }),
};
