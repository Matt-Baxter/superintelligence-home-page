import { z } from "zod";

export const tone = z.enum(["neutral", "accent", "good", "warn", "bad"]);
