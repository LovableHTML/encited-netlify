import * as z from "zod";

export const TeamConfigSchema = z.object({
  apiKey: z
    .string()
    .min(16, "Paste the full API key from your Encited dashboard"),
});

export type TeamConfig = z.output<typeof TeamConfigSchema>;
