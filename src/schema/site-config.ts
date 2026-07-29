import * as z from "zod";

export const SiteConfigSchema = z.object({
  enabled: z.boolean(),
});

export type SiteConfig = z.output<typeof SiteConfigSchema>;
