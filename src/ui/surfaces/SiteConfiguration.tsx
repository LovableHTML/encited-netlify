import {
  Alert,
  Button,
  Card,
  CardLoader,
  CardTitle,
  Link,
  SiteConfigurationSurface,
} from "@netlify/sdk/ui/react/components";
import { trpc } from "../trpc";

type TestStatus =
  | "ok"
  | "invalid_key"
  | "domain_not_registered"
  | "subscription_required"
  | "domain_misconfigured"
  | "unreachable"
  | "error";

const testResultView = (
  status: TestStatus,
  domain: string,
): { type: "success" | "error"; message: string } => {
  if (status === "ok") {
    return {
      type: "success",
      message: `Encited responded for ${domain} — your API key, domain, and subscription all check out.`,
    };
  }
  if (status === "invalid_key") {
    return {
      type: "error",
      message:
        "Encited rejected the API key. Paste a valid key in the team-level extension configuration.",
    };
  }
  if (status === "domain_not_registered") {
    return {
      type: "error",
      message: `${domain} isn't registered in your Encited workspace (or the key is scoped to another domain). Add it in the Encited dashboard, then test again.`,
    };
  }
  if (status === "subscription_required") {
    return {
      type: "error",
      message:
        "Your Encited workspace has no active subscription. Pick a plan in the Encited dashboard, then test again.",
    };
  }
  if (status === "domain_misconfigured") {
    return {
      type: "error",
      message: `${domain} is registered but has no origin host configured in Encited. Check the domain's settings in the Encited dashboard.`,
    };
  }
  return {
    type: "error",
    message: "Could not reach Encited. Try again in a moment.",
  };
};

export const SiteConfiguration = () => {
  const trpcUtils = trpc.useUtils();
  const siteSettingsQuery = trpc.siteSettings.query.useQuery();
  const setEnabledMutation = trpc.siteSettings.setEnabled.useMutation({
    onSuccess: async () => {
      await trpcUtils.siteSettings.query.invalidate();
    },
  });
  const testMutation = trpc.siteSettings.testConnection.useMutation();

  if (siteSettingsQuery.isLoading) {
    return <CardLoader />;
  }
  const settings = siteSettingsQuery.data;
  if (!settings) {
    return null;
  }

  if (!settings.hasApiKey) {
    return (
      <SiteConfigurationSurface>
        <Card>
          <CardTitle>Encited Prerendering</CardTitle>
          <Alert type="warn">
            Connect your Encited account first: open this extension's team-level
            configuration and paste your API key.
          </Alert>
        </Card>
      </SiteConfigurationSurface>
    );
  }

  const testResult = testMutation.data;

  return (
    <SiteConfigurationSurface>
      <Card>
        <CardTitle>Encited Prerendering</CardTitle>
        <p>
          Serves Encited's rendered snapshots of{" "}
          <strong>{settings.domain}</strong> to crawlers and AI agents; regular
          visitors keep getting your SPA. Make sure {settings.domain} is added
          to your{" "}
          <Link href="https://encited.com/dashboard">Encited workspace</Link>.
        </p>
        {settings.enabled ? (
          <Alert type="success">
            Prerendering is enabled. Crawler requests are served from Encited on
            every deploy.
          </Alert>
        ) : (
          <Alert type="warn">
            Prerendering is disabled for this site. Crawlers currently receive
            your unrendered SPA shell.
          </Alert>
        )}
        <p>
          Enabling or disabling updates this site's environment variables and
          triggers a redeploy so the change takes effect immediately.
        </p>
        <Button
          onClick={() =>
            setEnabledMutation.mutate({ enabled: !settings.enabled })
          }
          loading={setEnabledMutation.isPending}
          variant={settings.enabled ? "danger" : "standard"}
        >
          {settings.enabled ? "Disable prerendering" : "Enable prerendering"}
        </Button>
        <Button
          level="secondary"
          onClick={() => testMutation.mutate()}
          loading={testMutation.isPending}
        >
          Test connection
        </Button>
        {testResult && (
          <Alert type={testResultView(testResult.status, settings.domain).type}>
            {testResultView(testResult.status, settings.domain).message}
          </Alert>
        )}
        {setEnabledMutation.error && (
          <Alert type="error">{setEnabledMutation.error.message}</Alert>
        )}
        {testMutation.error && (
          <Alert type="error">{testMutation.error.message}</Alert>
        )}
      </Card>
    </SiteConfigurationSurface>
  );
};
