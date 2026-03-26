import { RestStagingDO } from "@bio-mcp/shared/staging/rest-staging-do";
import type { SchemaHints } from "@bio-mcp/shared/staging/schema-inference";

export class EiaDataDO extends RestStagingDO {
    /**
     * Intercept /process to unwrap EIA's nested response envelope.
     * EIA v2 returns { warnings: [...], response: { total, data: [...] } }.
     * The base class's detectArrays() would find `warnings` first and stage that
     * instead of the actual data array. We extract `response.data` and re-POST it.
     */
    async fetch(request: Request): Promise<Response> {
        const url = new URL(request.url);

        if (url.pathname === "/process" && request.method === "POST") {
            const raw = await request.json();
            const json = (raw !== null && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
            const data = (json.data ?? json) as Record<string, unknown>;

            // Unwrap EIA envelope: { response: { data: [...] } } → just the data array
            if (data.response && typeof data.response === "object") {
                const resp = data.response as Record<string, unknown>;
                if (resp.data && Array.isArray(resp.data) && resp.data.length > 0) {
                    const reRequest = new Request(request.url, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ data: resp.data }),
                    });
                    return super.fetch(reRequest);
                }
            }

            // Fallback: pass through as-is
            const reRequest = new Request(request.url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(json),
            });
            return super.fetch(reRequest);
        }

        return super.fetch(request);
    }

    protected getSchemaHints(data: unknown): SchemaHints | undefined {
        if (!data || typeof data !== "object") return undefined;

        // After unwrapping, data is the array itself or wrapped in { data: [...] }
        const arr = Array.isArray(data) ? data : null;
        const items = arr ?? (data as Record<string, unknown>);

        // Check if it's an array of EIA records
        const sample = (Array.isArray(items) ? items[0] : null) as Record<string, unknown> | null;
        if (!sample) return undefined;

        // Petroleum data
        if (
            sample.duoarea ||
            sample["series-description"]?.toString().toLowerCase().includes("petroleum")
        ) {
            return {
                tableName: "petroleum_data",
                indexes: ["period", "duoarea", "series"],
            };
        }

        // Natural gas
        if (
            sample.process?.toString().toLowerCase().includes("gas") ||
            sample["series-description"]?.toString().toLowerCase().includes("natural gas")
        ) {
            return {
                tableName: "natural_gas_data",
                indexes: ["period", "duoarea", "series"],
            };
        }

        // Electricity
        if (
            sample.sectorid ||
            sample.fuelTypeId ||
            sample["series-description"]?.toString().toLowerCase().includes("electric")
        ) {
            return {
                tableName: "electricity_data",
                indexes: ["period", "stateId", "sectorid"],
            };
        }

        // Generic data with period
        if (sample.period) {
            return {
                tableName: "eia_data",
                indexes: ["period", "series"],
            };
        }

        return undefined;
    }
}
