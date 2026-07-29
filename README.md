# Encited Prerendering — Netlify Extension

Netlify extension that serves [Encited](https://encited.com) prerendered HTML to crawlers and AI agents while human visitors get the SPA. Built with the [Netlify SDK](https://developers.netlify.com/sdk/).

## Architecture

- `src/index.ts` — extension entry. Injects the edge function into a site's build when that site has prerendering enabled (gated on the `ENCITED_PRERENDER_ENABLED` / `ENCITED_API_KEY` env vars the UI writes), and registers an `onSuccess` build event handler that asks Encited to invalidate and prewarm the site's snapshot cache after each deploy.
- `src/edge-functions/prerender.ts` — the injected edge function. Filters to public HTML GET navigations, calls `GET https://encited.com/api/prerender/render`, and maps the response contract: `200` → serve snapshot, `301` → forward redirect, `304`/error → pass through to the SPA. Fails open (`onError: "bypass"`).
- `src/server/router.ts` — tRPC endpoints backing the UI: save the team API key, enable/disable a site (writes/deletes env vars, saves site config, redeploys), and test the connection against Encited's render API.
- `src/ui/surfaces/` — team configuration (connect account) and site configuration (enable toggle + connection test).

## Environment variables written to enabled sites

| Variable                    | Purpose                                                              |
| --------------------------- | -------------------------------------------------------------------- |
| `ENCITED_API_KEY`           | Secret; auth for the render API (scopes: builds, functions, runtime) |
| `ENCITED_PRERENDER_ENABLED` | Gates edge-function injection at build time                          |

`ENCITED_BASE_URL` can be set manually on a site to point at a non-production Encited instance.

## Develop

```bash
pnpm install
pnpm run dev            # local extension dev server (requires netlify-cli login)
pnpm run build          # builds into .ntli/ — what Netlify runs
pnpm exec tsc --build   # typecheck both backend and UI projects
```

## Publish

The extension is hosted as a Netlify project; every production deploy of that project updates the published extension. See [publishing docs](https://developers.netlify.com/sdk/publish/publish-extensions/) and the [partner extension process](https://developers.netlify.com/sdk/publish/partner-extensions/).
