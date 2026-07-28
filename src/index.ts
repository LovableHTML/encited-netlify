// Documentation: https://sdk.netlify.com/docs

import { NetlifyExtension } from "@netlify/sdk";
import type { TeamConfig } from "./schema/team-config.js";
import type { SiteConfig } from "./schema/site-config.js";

const extension = new NetlifyExtension<SiteConfig, TeamConfig>();

extension.addEdgeFunctions("./src/edge-functions", {
  prefix: "ef_prefix",
  shouldInjectFunction: () => {
    // If the edge function is not enabled, return early
    if (!process.env["ENCITED_ENABLED"]) {
      return false;
    }
    return true;
  },
});

export { extension };

