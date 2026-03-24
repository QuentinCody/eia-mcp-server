import type { ApiFetchFn } from "@bio-mcp/shared/codemode/catalog";
import { eiaFetch } from "./http";

let envApiKey: string | undefined;

export function setEiaApiKey(key: string | undefined) {
    envApiKey = key;
}

export function createEiaApiFetch(): ApiFetchFn {
    return async (request) => {
        const params = { ...((request.params as Record<string, unknown>) || {}) };

        // EIA paths map directly (e.g. /v2/petroleum/pri/spt/data)
        const response = await eiaFetch(request.path, params, { apiKey: envApiKey });

        if (!response.ok) {
            const errorBody = await response.text().catch(() => response.statusText);
            const error = new Error(`HTTP ${response.status}: ${errorBody.slice(0, 200)}`) as Error & {
                status: number;
                data: unknown;
            };
            error.status = response.status;
            error.data = errorBody;
            throw error;
        }

        const data = await response.json();
        return { status: response.status, data };
    };
}
