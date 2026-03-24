import { RestStagingDO } from "@bio-mcp/shared/staging/rest-staging-do";
import type { SchemaHints } from "@bio-mcp/shared/staging/schema-inference";

export class EiaDataDO extends RestStagingDO {
    protected getSchemaHints(data: unknown): SchemaHints | undefined {
        if (!data || typeof data !== "object") return undefined;

        const obj = data as Record<string, unknown>;

        // Standard EIA v2 response: { response: { data: [...] } }
        if (obj.response && typeof obj.response === "object") {
            const resp = obj.response as Record<string, unknown>;

            if (resp.data && Array.isArray(resp.data)) {
                const sample = resp.data[0] as Record<string, unknown> | undefined;
                if (!sample) return undefined;

                // Petroleum data
                if (
                    sample.duoarea ||
                    sample["series-description"]
                        ?.toString()
                        .toLowerCase()
                        .includes("petroleum")
                ) {
                    return {
                        tableName: "petroleum_data",
                        indexes: ["period", "duoarea", "series"],
                    };
                }

                // Natural gas
                if (
                    sample.process?.toString().toLowerCase().includes("gas") ||
                    sample["series-description"]
                        ?.toString()
                        .toLowerCase()
                        .includes("natural gas")
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
                    sample["series-description"]
                        ?.toString()
                        .toLowerCase()
                        .includes("electric")
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
            }
        }

        return undefined;
    }
}
