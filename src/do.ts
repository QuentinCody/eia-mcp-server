import { RestStagingDO } from "@bio-mcp/shared/staging/rest-staging-do";
import type { SchemaHints } from "@bio-mcp/shared/staging/schema-inference";

const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
function unwrap(value: unknown): unknown {
  return record(value) && Array.isArray(value.content) && record(value.structuredContent) && "data" in value.structuredContent
    ? value.structuredContent.data : value;
}
function source(value: unknown) {
  const data = unwrap(value);
  const native = record(data) && record(data.data) && record(data.data.response) ? data.data : data;
  if (!record(native) || !record(native.response)) return;
  const response = native.response;
  let collection: string | undefined;
  let table = "eia_metadata";
  if (Array.isArray(response.data)) {
    collection = "data"; table = "eia_data";
    const sample = record(response.data[0]) ? response.data[0] : {};
    const description = String(sample["series-description"] ?? "").toLowerCase();
    if (sample.sectorid || sample.fuelTypeId || description.includes("electric")) table = "electricity_data";
    else if (String(sample.process ?? "").toLowerCase().includes("gas") || description.includes("natural gas")) table = "natural_gas_data";
    else if (sample.duoarea || description.includes("petroleum")) table = "petroleum_data";
  } else if (Array.isArray(response.routes)) { collection = "routes"; table = "eia_routes"; }
  else if (Array.isArray(response.facets) && !response.frequency && !response.data) { collection = "facets"; table = "eia_facets"; }
  return {native, response, table, collection, rows: collection ? response[collection] as unknown[] : [response]};
}

/** Keep complete payloads while projecting ordered native records for SQL. */
export class EiaDataDO extends RestStagingDO {
  protected getTabularData(value: unknown): unknown {
    const data = unwrap(value);
    if (record(data) && typeof data.sql === "string" && Array.isArray(data.rows)) {
      return {query_rows: data.rows.map((native, row_index) => ({row_index, native_json: JSON.stringify(native)}))};
    }
    const found = source(data);
    if (!found) return data;
    const names = new Map(["_rowid", "mcp_source_index", "mcp_native_json"].map(name => [name, name]));
    const rows = found.rows.map((native, mcp_source_index) => {
      const row: Record<string, unknown> = {mcp_source_index, mcp_native_json: JSON.stringify(native)};
      for (const [key, item] of Object.entries(record(native) ? native : {})) {
        const lower = key.toLowerCase();
        if (item !== null && typeof item === "object" || ["_rowid", "mcp_source_index", "mcp_native_json"].includes(lower)) continue;
        if (names.has(lower) && names.get(lower) !== key) continue;
        names.set(lower, key); row[key] = item;
      }
      return row;
    });
    const controls = {...found.response};
    if (found.collection) delete controls[found.collection];
    const {response: _response, ...envelope} = found.native;
    return {[found.table]: rows, eia_response: [{response_index: 0, collection: found.collection ?? null,
      native_json: JSON.stringify({...envelope, response: controls})}]};
  }

  protected getSchemaHints(value: unknown): SchemaHints | undefined {
    const found = source(value);
    if (!found) return undefined;
    const columnTypes: Record<string, string> = {mcp_native_json: "TEXT", native_json: "TEXT", collection: "TEXT"};
    for (const row of found.rows) if (record(row)) for (const [key, item] of Object.entries(row)) {
      if (typeof item === "string") columnTypes[key] = "TEXT";
    }
    columnTypes.mcp_source_index = "INTEGER";
    return {columnTypes};
  }
}
