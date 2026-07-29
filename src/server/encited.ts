// Read via globalThis so this module also typechecks in the UI project,
// which compiles without Node globals (the browser bundle never runs this).
const nodeEnv =
  (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env ?? {};

export const ENCITED_BASE_URL =
  nodeEnv["ENCITED_BASE_URL"] ?? "https://encited.com";

export const API_KEY_ENV_VAR = "ENCITED_API_KEY";
export const ENABLED_ENV_VAR = "ENCITED_PRERENDER_ENABLED";

const USER_AGENT = "Encited-Netlify-Extension/1.0 (+https://encited.com)";

export type TestConnectionResult = {
  status:
    | "ok"
    | "invalid_key"
    | "domain_not_registered"
    | "subscription_required"
    | "domain_misconfigured"
    | "unreachable"
    | "error";
  httpStatus?: number;
  errorCode?: string;
};

const readErrorCode = async (res: Response): Promise<string | undefined> => {
  try {
    const body = (await res.json()) as { error?: string };
    return body.error;
  } catch {
    return undefined;
  }
};

/**
 * Probes GET /api/prerender/render for the site's domain. Any of 200/301/304
 * proves the key is valid, the domain is registered, and the subscription is
 * active — 304 just means Encited chose passthrough for this request.
 */
export const testRenderConnection = async ({
  apiKey,
  domain,
}: {
  apiKey: string;
  domain: string;
}): Promise<TestConnectionResult> => {
  const target = `https://${domain}/`;
  let res: Response;
  try {
    res = await fetch(
      `${ENCITED_BASE_URL}/api/prerender/render?url=${encodeURIComponent(target)}`,
      {
        headers: {
          authorization: `Bearer ${apiKey}`,
          accept: "text/html",
          "user-agent": USER_AGENT,
        },
        redirect: "manual",
        signal: AbortSignal.timeout(30_000),
      },
    );
  } catch {
    return { status: "unreachable" };
  }

  if (res.status === 200 || res.status === 301 || res.status === 304) {
    return { status: "ok", httpStatus: res.status };
  }

  const errorCode = await readErrorCode(res);
  const result: TestConnectionResult = {
    httpStatus: res.status,
    status: "error",
  };
  if (errorCode !== undefined) result.errorCode = errorCode;

  if (res.status === 401) result.status = "invalid_key";
  else if (res.status === 402) result.status = "subscription_required";
  else if (res.status === 403) result.status = "domain_not_registered";
  else if (res.status === 400 && errorCode === "domain_has_no_origin_host") {
    result.status = "domain_misconfigured";
  }
  return result;
};

/**
 * Asks Encited to invalidate the domain's whole snapshot cache and prewarm it.
 * Called after a successful deploy so the cache never serves the previous
 * release to crawlers. Unlike invalidate-updated-paths, this doesn't depend on
 * a configured sitemap to decide what to invalidate.
 */
export const requestPostDeployRecache = async ({
  apiKey,
  domain,
}: {
  apiKey: string;
  domain: string;
}): Promise<{ ok: boolean; httpStatus: number; errorCode?: string }> => {
  const res = await fetch(
    `${ENCITED_BASE_URL}/api/prerender/cache/invalidate-site-cache`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
        "user-agent": USER_AGENT,
      },
      body: JSON.stringify({ domain, prewarm: true }),
      signal: AbortSignal.timeout(30_000),
    },
  );
  const result: { ok: boolean; httpStatus: number; errorCode?: string } = {
    ok: res.ok,
    httpStatus: res.status,
  };
  if (!res.ok) {
    const errorCode = await readErrorCode(res);
    if (errorCode !== undefined) result.errorCode = errorCode;
  }
  return result;
};
