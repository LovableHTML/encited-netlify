import { TRPCError } from "@trpc/server";
import * as z from "zod";
import type { NetlifyExtensionClient } from "@netlify/sdk";
import { procedure, router } from "./trpc";
import { TeamConfigSchema } from "../schema/team-config";
import { SiteConfigSchema } from "../schema/site-config";
import {
  API_KEY_ENV_VAR,
  ENABLED_ENV_VAR,
  testRenderConnection,
} from "./encited";

type Client = NetlifyExtensionClient<unknown, unknown>;

const requireTeamId = (teamId: string | null): string => {
  if (!teamId) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "teamId is required" });
  }
  return teamId;
};

const requireSiteId = (siteId: string | null): string => {
  if (!siteId) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "siteId is required" });
  }
  return siteId;
};

const getTeamApiKey = async (
  client: Client,
  teamId: string,
): Promise<string | null> => {
  const teamConfig = await client.getTeamConfiguration(teamId);
  if (!teamConfig) return null;
  const parsed = TeamConfigSchema.safeParse(teamConfig.config);
  return parsed.success ? parsed.data.apiKey : null;
};

// The SDK's Site type omits the domain fields the Netlify API actually
// returns; widen with the documented site-object fields we rely on.
type SiteWithDomains = {
  custom_domain?: string | null;
  ssl_url?: string;
  url?: string;
};

const getSiteDomain = async (
  client: Client,
  siteId: string,
): Promise<string> => {
  const site = (await client.getSite(siteId)) as SiteWithDomains;
  if (site.custom_domain) return site.custom_domain;
  const url = site.ssl_url || site.url;
  if (url) return new URL(url).hostname;
  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "Could not resolve the site's domain",
  });
};

export const appRouter = router({
  teamSettings: {
    query: procedure.query(async ({ ctx: { teamId, client } }) => {
      const apiKey = await getTeamApiKey(client, requireTeamId(teamId));
      return {
        hasApiKey: apiKey !== null,
        apiKeyPreview: apiKey ? `••••${apiKey.slice(-4)}` : null,
      };
    }),

    mutate: procedure
      .input(TeamConfigSchema)
      .mutation(async ({ ctx: { teamId: rawTeamId, client }, input }) => {
        const teamId = requireTeamId(rawTeamId);
        try {
          const existingConfig = await client.getTeamConfiguration(teamId);
          if (!existingConfig) {
            await client.createTeamConfiguration(teamId, input);
          } else {
            await client.updateTeamConfiguration(teamId, input);
          }
        } catch (e) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to save team configuration",
            cause: e,
          });
        }

        // Propagate the (possibly rotated) key to every site that already has
        // prerendering enabled — their ENCITED_API_KEY env var would otherwise
        // keep the old key until someone re-enabled the site by hand, and the
        // edge function would silently fail open once the old key is revoked.
        let sites;
        try {
          sites = await client.getSites();
        } catch {
          return { updatedSites: [], failedSites: [], propagationFailed: true };
        }
        const results = await Promise.all(
          sites.map(async (site) => {
            try {
              const siteConfig = await client.getSiteConfiguration(
                teamId,
                site.id,
              );
              const parsed = SiteConfigSchema.safeParse(siteConfig?.config);
              if (!parsed.success || !parsed.data.enabled) return null;
              await client.createOrUpdateVariables({
                accountId: teamId,
                siteId: site.id,
                variables: { [API_KEY_ENV_VAR]: input.apiKey },
                isSecret: true,
                scopes: ["builds", "functions", "runtime"],
              });
              // Redeploy so the new key takes effect without manual action; a
              // site that can't redeploy still has the env var for next deploy.
              await client.redeploySite({ siteId: site.id }).catch(() => {});
              return { site: site.name, ok: true as const };
            } catch {
              return { site: site.name, ok: false as const };
            }
          }),
        );
        const touched = results.filter((r) => r !== null);
        return {
          updatedSites: touched.filter((r) => r.ok).map((r) => r.site),
          failedSites: touched.filter((r) => !r.ok).map((r) => r.site),
          propagationFailed: false,
        };
      }),
  },

  siteSettings: {
    query: procedure.query(
      async ({ ctx: { teamId: rawTeamId, siteId: rawSiteId, client } }) => {
        const teamId = requireTeamId(rawTeamId);
        const siteId = requireSiteId(rawSiteId);

        const [apiKey, domain, siteConfig] = await Promise.all([
          getTeamApiKey(client, teamId),
          getSiteDomain(client, siteId),
          client.getSiteConfiguration(teamId, siteId),
        ]);

        const parsed = SiteConfigSchema.safeParse(siteConfig?.config);
        return {
          hasApiKey: apiKey !== null,
          domain,
          enabled: parsed.success ? parsed.data.enabled : false,
        };
      },
    ),

    setEnabled: procedure
      .input(z.object({ enabled: z.boolean() }))
      .mutation(
        async ({
          ctx: { teamId: rawTeamId, siteId: rawSiteId, client },
          input,
        }) => {
          const teamId = requireTeamId(rawTeamId);
          const siteId = requireSiteId(rawSiteId);

          if (input.enabled) {
            const apiKey = await getTeamApiKey(client, teamId);
            if (!apiKey) {
              throw new TRPCError({
                code: "PRECONDITION_FAILED",
                message:
                  "Connect your Encited account in the team-level extension configuration first",
              });
            }
            await client.createOrUpdateVariables({
              accountId: teamId,
              siteId,
              variables: { [API_KEY_ENV_VAR]: apiKey },
              isSecret: true,
              scopes: ["builds", "functions", "runtime"],
            });
            await client.createOrUpdateVariables({
              accountId: teamId,
              siteId,
              variables: { [ENABLED_ENV_VAR]: "true" },
            });
          } else {
            try {
              await client.deleteEnvironmentVariables({
                accountId: teamId,
                siteId,
                variables: [API_KEY_ENV_VAR, ENABLED_ENV_VAR],
              });
            } catch (e) {
              // Already-deleted variables are fine; anything else must abort
              // before the config below claims "disabled" while the env vars
              // still exist and keep the edge function injected.
              const status = (e as { status?: number }).status;
              if (status !== 404) {
                throw new TRPCError({
                  code: "INTERNAL_SERVER_ERROR",
                  message:
                    "Failed to remove the site's Encited environment variables — prerendering is still enabled. Try again.",
                  cause: e,
                });
              }
            }
          }

          const existing = await client.getSiteConfiguration(teamId, siteId);
          if (!existing) {
            await client.createSiteConfiguration(teamId, siteId, {
              enabled: input.enabled,
            });
          } else {
            await client.updateSiteConfiguration(teamId, siteId, {
              enabled: input.enabled,
            });
          }

          // Injection happens at build time, so the change only takes effect
          // on the next deploy.
          await client.redeploySite({ siteId });
        },
      ),

    testConnection: procedure.mutation(
      async ({ ctx: { teamId: rawTeamId, siteId: rawSiteId, client } }) => {
        const teamId = requireTeamId(rawTeamId);
        const siteId = requireSiteId(rawSiteId);

        const apiKey = await getTeamApiKey(client, teamId);
        if (!apiKey) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message:
              "Connect your Encited account in the team-level extension configuration first",
          });
        }
        const domain = await getSiteDomain(client, siteId);
        return await testRenderConnection({ apiKey, domain });
      },
    ),
  },
});

export type AppRouter = typeof appRouter;
