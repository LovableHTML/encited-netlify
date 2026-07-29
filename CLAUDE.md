# CLAUDE.md

Netlify partner extension for Encited (SPA prerendering for crawlers/AI agents). Built on the Netlify SDK (`@netlify/sdk`). The extension injects an edge function into customer sites that forwards crawler-eligible requests to Encited's render API; humans get the SPA untouched.

## Commands

```bash
npm install
npm run dev          # extension dev server (requires netlify-cli login)
npm run build        # netlify-extension build → .ntli/ (what Netlify runs)
npm run typecheck    # tsc --build (backend + UI project references)
npm run lint         # eslint flat config
npm run format       # prettier --write
```

No test framework. Validation = typecheck + lint + build. All three must pass before committing.

## Architecture

| Piece                  | File                              | Runs where                                                  |
| ---------------------- | --------------------------------- | ----------------------------------------------------------- |
| Extension entry        | `src/index.ts`                    | Customer site builds (injection gate + `onSuccess` recache) |
| Injected edge function | `src/edge-functions/prerender.ts` | Customer site edge (Deno)                                   |
| tRPC endpoints         | `src/server/router.ts`            | Extension's Netlify functions                               |
| Encited API helpers    | `src/server/encited.ts`           | Extension functions + build handler                         |
| UI surfaces            | `src/ui/surfaces/*.tsx`           | Netlify app dashboard (team + site config)                  |

Flow: team surface stores the Encited API key in team configuration → site surface enable writes two env vars to the site (`ENCITED_API_KEY` secret with builds/functions/runtime scopes, `ENCITED_PRERENDER_ENABLED`) and triggers a redeploy → `shouldInjectFunction` in `src/index.ts` sees those env vars during the site's build and injects the edge function. Saving a new team key propagates the env var to every enabled site and redeploys them (`teamSettings.mutate`), so key rotation can't silently strand sites on a revoked key. The extension installs team-wide; this env-var gate is the only thing keeping the edge function out of every other site the team owns. Never weaken it.

## The Encited API contract

The render endpoint (`GET /api/prerender/render?url=…`, `Authorization: Bearer <key>`) response contract the edge function relies on:

- `200 text/html` — serve the snapshot body
- `301` + `Location` — configured redirect rule; forward to the client
- `304` — Encited chose passthrough (browser navigation, asset, non-HTML); call `context.next()`
- Anything else / fetch failure — fail open, `context.next()`

Error codes the connection test maps: `401` invalid key, `402 subscription_required`, `403` `domain_not_owned` / `api_key_domain_scope_mismatch`, `400 domain_has_no_origin_host`. Post-deploy recache uses `POST /api/prerender/cache/invalidate-site-cache` with `{ domain, prewarm: true }` (full-site invalidate; doesn't depend on a configured sitemap).

The source of truth for this contract is `worker/routes/prerender.ts` in the main Encited repo (`../lovablehtml`). If behavior seems off, check there before changing the mapping here. Domain onboarding rides the render endpoint's `pending → "via api"` auto-transition — do NOT switch to the Domains API (`/api/domains`), it's gated to Business+ plans and would break lower tiers.

## Edge function constraints (src/edge-functions/)

Injected edge functions run on Netlify's Deno edge runtime and are copied into customer sites:

- Inline `config` export only; no npm imports, no Node builtins, no imports from elsewhere in this repo — the file must stay self-contained (env var names are intentionally duplicated as literals here).
- `Netlify.env.get()` for env access (declared as a global in the file).
- Keep `onError: "bypass"` and the fail-open catch: a broken Encited must never take down a customer site.
- `excludedPath` trims asset invocations for the customer's bill; correctness never depends on it (Encited 304s non-HTML anyway).

## Version constraints — do not "fix" these

All pinned by `@netlify/sdk` compatibility; each was verified by an actual failure:

- **TypeScript 5.x, never 7.x** — TS 7's compiler API crashes the SDK build (`Cannot read properties of undefined (reading 'Intrinsic')`).
- **React 18 / Tailwind 3** — `@netlify/sdk--ui-react` peer-requires `react ^18.3.1`, `tailwindcss ^3.4.3`.
- **zod 3** — the SDK `Form` component bundles its own zod-3 resolver; zod-4 schemas passed into it risk runtime breakage.
- **`cssMinify: "esbuild"` in `vite.config.ts`** — Vite 8's lightningcss default hard-errors on an unescaped SVG data-URL inside the SDK's own stylesheet.

Revisit all four only on a new `@netlify/sdk` major.

## Conventions

- Package manager is **npm** (`packageManager` field is authoritative). Avoid bun: its hoisting breaks `@netlify/build`'s named-export imports (`signal-exit`, `resolve`).
- Relative imports are extensionless (`from "./trpc"`, not `"./trpc.js"`); both tsconfig projects use bundler module resolution to allow it.
- The UI never receives the API key back from the server — `teamSettings.query` returns only `hasApiKey` + a masked preview. Keep it that way.
- SDK UI components only (`@netlify/sdk/ui/react/components`); `Alert` levels are `success | error | info | warn` (not `warning`).
- The SDK's `Site` type omits domain fields the API actually returns; `SiteWithDomains` in `src/server/router.ts` is the deliberate widening for that.

## Publishing

The extension is hosted as a Netlify project; every production deploy updates the published extension immediately (no version pinning), and a public extension can never go private again. `details.md` is the marketplace listing page. Partner submission goes through Netlify's technology partner program (contact early; they review end to end).
