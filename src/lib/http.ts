import { restFetch } from "@bio-mcp/shared/http/rest-fetch";
import type { RestFetchOptions } from "@bio-mcp/shared/http/rest-fetch";

const EIA_BASE = "https://api.eia.gov";

export interface EiaFetchOptions extends Omit<RestFetchOptions, "retryOn"> {
    apiKey?: string;
}

/**
 * Fetch from the EIA API v2.
 * All requests include api_key as query param.
 */
export async function eiaFetch(
    path: string,
    params?: Record<string, unknown>,
    opts?: EiaFetchOptions,
): Promise<Response> {
    const apiKey = opts?.apiKey || "";
    const queryParams: Record<string, unknown> = {
        api_key: apiKey,
        ...params,
    };

    return restFetch(EIA_BASE, path, queryParams, {
        ...opts,
        headers: {
            Accept: "application/json",
            ...(opts?.headers ?? {}),
        },
        retryOn: [429, 500, 502, 503],
        retries: opts?.retries ?? 2,
        timeout: opts?.timeout ?? 30_000,
        userAgent: "eia-mcp-server/1.0 (bio-mcp)",
    });
}
