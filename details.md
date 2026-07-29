# Encited Prerendering

Serve fully rendered HTML to search engines and AI crawlers — GPTBot, ClaudeBot, PerplexityBot, Googlebot — while your visitors keep getting your SPA exactly as deployed.

AI crawlers don't execute JavaScript. If your site is a client-side rendered SPA, they see an empty HTML shell: no content, no citations, no visibility in AI answers. Encited fixes that without an SSR migration and without running a headless browser in your own Netlify Functions.

## How it works

The extension injects a lightweight edge function into your site's deploys. It forwards crawler-eligible requests to Encited's rendering API, which returns a cached, fully rendered snapshot; regular browser navigations pass straight through to your SPA. Rendering and caching run on Encited's infrastructure — the only thing billed to your Netlify account is the thin edge function.

After every successful deploy, the extension asks Encited to refresh the site's rendered snapshots, so crawlers never see your previous release.

## Setup

1. Create an [Encited](https://encited.com) account and add your site's domain.
2. Create an account-wide API key in **Settings → API keys**.
3. Install this extension, paste the key in the team-level configuration.
4. Open the extension on a site and click **Enable prerendering**. The extension sets the site's environment variables and triggers a redeploy.
5. Click **Test connection** to confirm end to end.

## What you get with Encited

- On-demand rendering API with cache invalidation and prewarming
- Crawler analytics: which bots visit, what they're served, crawl-budget savings
- Snapshot inspector — see exactly what crawlers see
- Index status tracking and AI-visibility monitoring

An active Encited subscription is required. Manage plans at [encited.com](https://encited.com).
