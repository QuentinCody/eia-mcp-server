import type { ApiEndpoint, WorkflowRecipe } from "@bio-mcp/shared/codemode/catalog";
export const discoveryNotes =
  "- Discover metadata at /discovery/metadata (default route /v2), then child routes and /discovery/facet values. Query discovered leaves with /discovery/data.\n" +
  "- Staged metadata/facets/routes use eia_metadata/eia_facets/eia_routes; observations use electricity_data/natural_gas_data/petroleum_data/eia_data. mcp_source_index preserves order; mcp_native_json preserves native records. eia_response retains controls; payloads retains complete source envelopes.\n" +
  "- Source JSON and original-byte hashes survive staging with explicit credential redaction. Totals, warnings and page exhaustion do not establish complete history or an atomic snapshot.\n";
const route = {name: "route", type: "string" as const, required: true, description: "Metadata route discovered from parent routes, e.g. /v2/electricity/retail-sales. Omit /data and /facet."};
export const discoveryEndpoints: ApiEndpoint[] = [
  {method: "GET", path: "/discovery/metadata", summary: "Discover EIA child routes or dataset frequencies, facets, data columns, units and period bounds (local helper)", category: "discovery", queryParams: [{...route, required: false, default: "/v2"}]},
  {method: "GET", path: "/discovery/facet", summary: "List native IDs and labels for a facet discovered in EIA metadata (local helper)", category: "discovery", queryParams: [route, {name: "facet", type: "string", required: true, description: "Exact facet ID from metadata, e.g. sectorid"}]},
  {method: "GET", path: "/discovery/data", summary: "Query observations for a discovered EIA dataset, preserving its envelope, warnings and totals (local helper)", category: "discovery", queryParams: [route,
    {name: "frequency", type: "string", required: false, description: "Exact supported frequency ID from metadata"},
    {name: "data[]", type: "string", required: true, description: "Discovered data column; pass an array for multiple columns. Additional native bracket parameters such as facets[stateid][] are supported."},
    {name: "start", type: "string", required: false, description: "First period in dataset date format"},
    {name: "end", type: "string", required: false, description: "Last period in dataset date format"},
    {name: "length", type: "number", required: false, description: "Page size, at most 5000; prefer small pages", default: 100},
    {name: "offset", type: "number", required: false, description: "Pagination offset", default: 0},
    {name: "sort[0][column]", type: "string", required: false, description: "Sort column, e.g. period"},
    {name: "sort[0][direction]", type: "string", required: false, description: "asc or desc"},
  ]},
];
export const discoveryWorkflows: WorkflowRecipe[] = [
  {title: "Discover EIA datasets and forecast editions", keywords: ["metadata", "routes", "AEO", "editions", "discovery"], description: "Start at a parent node and follow returned child IDs. AEO editions and leaf routes must be discovered, not guessed. Metadata is not observations. Return staged handles for SQL inspection before choosing the next route.", code: `return await api.get("/discovery/metadata", {route: "/v2/aeo"});`},
  {title: "Discover electricity price metadata and facet IDs before querying", keywords: ["electricity", "price", "metadata", "facets", "Colorado", "residential"], description: "Inspect dataset columns/frequency and verify the desired state/sector IDs, then fetch one small page. Read staged metadata/facets through SQL while retaining their source handles. Stop on read errors or metadata above the 131072-character local bound. Preserve native envelopes, units, warnings and totals; a page does not establish complete history.", code: `const route = "/v2/electricity/retail-sales";
async function metadataSpec(value) {
  if (!value.__staged) return value.data.response;
  const length = await api.query(value.data_access_id, "SELECT length(mcp_native_json) AS n FROM eia_metadata WHERE mcp_source_index=0");
  const n = length.results?.[0]?.n;
  if (length.error || !Number.isSafeInteger(n) || n < 1 || n > 131072) throw new Error("Staged metadata is unavailable or exceeds the local bound");
  let text = "";
  for (let offset = 1; offset <= n; offset += 4000) {
    const result = await api.query(value.data_access_id, "SELECT substr(mcp_native_json," + offset + ",4000) AS part FROM eia_metadata WHERE mcp_source_index=0");
    if (result.error || result.truncated || result.results?.length !== 1 || typeof result.results[0].part !== "string") throw new Error("Staged metadata read failed");
    text += result.results[0].part;
  }
  if (Array.from(text).length !== n) throw new Error("Incomplete staged metadata");
  return JSON.parse(text);
}
async function hasFacet(value, id) {
  if (!value.__staged) return value.data.response.facets.some(f => f.id === id);
  // IDs below are fixed literals, never model-supplied SQL fragments.
  const result = await api.query(value.data_access_id, "SELECT COUNT(*) AS n FROM eia_facets WHERE json_extract(mcp_native_json,'$.id')='" + id + "'");
  if (result.error || !Number.isSafeInteger(result.results?.[0]?.n)) throw new Error("Staged facet read failed");
  return result.results[0].n > 0;
}
const metadata = await api.get("/discovery/metadata", {route});
if (metadata.__api_error || metadata.__stage_error || metadata.__staged && typeof api.query !== "function") return metadata;
let spec;
try { spec = await metadataSpec(metadata); }
catch (error) { return {metadata, query_skipped: String(error)}; }
if (!spec?.data?.price || !Array.isArray(spec.frequency) || !spec.frequency.some(f => f?.id === "monthly") || !Array.isArray(spec.facets) || !["stateid", "sectorid"].every(id => spec.facets.some(f => f?.id === id)))
  return {metadata, query_skipped: "Required column, frequency or facets are unavailable"};
const evidence = {metadata};
for (const [facet, id] of [["stateid", "CO"], ["sectorid", "RES"]]) {
  const values = await api.get("/discovery/facet", {route, facet});
  evidence[facet] = values;
  if (values.__api_error || values.__stage_error || values.__staged && typeof api.query !== "function") return evidence;
  try {
    if (!await hasFacet(values, id)) return {...evidence, query_skipped: "Requested ID absent from returned facet values; inspect completeness"};
  } catch (error) { return {...evidence, query_skipped: String(error)}; }
}
return {...evidence, page: await api.get("/discovery/data", {route, frequency: "monthly", "data[]": "price", "facets[stateid][]": "CO", "facets[sectorid][]": "RES", "sort[0][column]": "period", "sort[0][direction]": "desc", length: 12, offset: 0}), complete_history_verified: false};`},
];
