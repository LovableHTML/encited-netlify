import {
  Alert,
  Card,
  CardLoader,
  CardTitle,
  Form,
  FormFieldSecret,
  Link,
  TeamConfigurationSurface,
} from "@netlify/sdk/ui/react/components";
import { TeamConfigSchema } from "../../schema/team-config";
import { trpc } from "../trpc";

type SaveResult = {
  updatedSites: string[];
  failedSites: string[];
  propagationFailed: boolean;
};

const saveResultView = (
  result: SaveResult,
): { type: "success" | "warn"; message: string } => {
  if (result.propagationFailed) {
    return {
      type: "warn",
      message:
        "Key saved, but your sites could not be checked — re-enable prerendering on each enabled site to update its key.",
    };
  }
  if (result.failedSites.length > 0) {
    return {
      type: "warn",
      message: `Key saved, but it could not be updated on: ${result.failedSites.join(", ")}. Re-enable prerendering on those sites to update their key.`,
    };
  }
  if (result.updatedSites.length > 0) {
    return {
      type: "success",
      message: `Key saved and updated on ${result.updatedSites.join(", ")} — each site is redeploying so the new key takes effect.`,
    };
  }
  return { type: "success", message: "Key saved." };
};

export const TeamConfiguration = () => {
  const trpcUtils = trpc.useUtils();
  const teamSettingsQuery = trpc.teamSettings.query.useQuery();
  const teamSettingsMutation = trpc.teamSettings.mutate.useMutation({
    onSuccess: async () => {
      await trpcUtils.teamSettings.query.invalidate();
    },
  });

  if (teamSettingsQuery.isLoading) {
    return <CardLoader />;
  }
  const settings = teamSettingsQuery.data;
  const saveResult = teamSettingsMutation.data;

  return (
    <TeamConfigurationSurface>
      <Card>
        <CardTitle>Connect your Encited account</CardTitle>
        <p className="tw-text-pretty">
          Encited serves fully rendered HTML to search engines and AI crawlers
          (Googlebot, GPTBot, ClaudeBot, PerplexityBot) while your visitors keep
          getting your SPA. Rendering runs on Encited's infrastructure, so your
          Netlify functions never run a headless browser.
        </p>
        <p className="tw-text-pretty">
          Create an account-wide API key in{" "}
          <Link href="https://encited.com/settings/api-keys">
            Encited → Settings → API keys
          </Link>{" "}
          and paste it below, then enable prerendering per site from each site's
          extension configuration.
        </p>
        {settings?.hasApiKey && !saveResult && (
          <Alert type="success" className="tw-my-3">
            Connected with API key {settings.apiKeyPreview}. Saving a new key
            replaces it and updates every site with prerendering enabled.
          </Alert>
        )}
        {saveResult && (
          <Alert type={saveResultView(saveResult).type} className="tw-my-3">
            {saveResultView(saveResult).message}
          </Alert>
        )}
        <Form
          defaultValues={{ apiKey: "" }}
          schema={TeamConfigSchema}
          onSubmit={async (values) => {
            await teamSettingsMutation.mutateAsync(values);
          }}
        >
          <FormFieldSecret
            name="apiKey"
            label="Encited API key"
            helpText="Use an account-wide key so every site on this team can be enabled."
          />
        </Form>
      </Card>
    </TeamConfigurationSurface>
  );
};
