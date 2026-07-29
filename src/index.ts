import { NetlifyExtension } from "@netlify/sdk";
import type { TeamConfig } from "./schema/team-config";
import type { SiteConfig } from "./schema/site-config";
import {
  API_KEY_ENV_VAR,
  ENABLED_ENV_VAR,
  requestPostDeployRecache,
} from "./server/encited";

const extension = new NetlifyExtension<SiteConfig, TeamConfig>();

// Both env vars are written per site when the user enables prerendering in the
// extension's site configuration UI. The extension installs team-wide, so this
// gate is what keeps the edge function out of every other site's builds.
const siteHasPrerenderEnabled = () =>
  process.env[ENABLED_ENV_VAR] === "true" && !!process.env[API_KEY_ENV_VAR];

extension.addEdgeFunctions("./src/edge-functions", {
  prefix: "encited",
  shouldInjectFunction: siteHasPrerenderEnabled,
});

extension.addBuildEventHandler("onSuccess", async () => {
  // Deploy previews and branch deploys also run onSuccess, but URL always
  // points at production — without this guard every PR push would invalidate
  // the live domain's snapshot cache.
  if (process.env["CONTEXT"] !== "production") return;
  if (!siteHasPrerenderEnabled()) return;
  const apiKey = process.env[API_KEY_ENV_VAR];
  const siteUrl = process.env["URL"];
  if (!apiKey || !siteUrl) return;

  const domain = new URL(siteUrl).hostname;
  try {
    const result = await requestPostDeployRecache({ apiKey, domain });
    if (result.ok) {
      console.log(`[Encited] Requested post-deploy recache for ${domain}`);
    } else {
      console.warn(
        `[Encited] Post-deploy recache request failed for ${domain} (${result.httpStatus}${result.errorCode ? `: ${result.errorCode}` : ""})`,
      );
    }
  } catch (e) {
    console.warn(
      `[Encited] Post-deploy recache request errored for ${domain}`,
      e,
    );
  }
});

export { extension };
