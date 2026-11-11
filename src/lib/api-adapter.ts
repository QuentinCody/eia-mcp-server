import type { ApiFetchFn } from "@bio-mcp/shared/codemode/catalog";
import { eiaJson, eiaPath, fail } from "./http";

export function createEiaApiFetch(apiKey?: string): ApiFetchFn {
  return async request => {
    if (request.method !== "GET" || request.body !== undefined) fail("EIA supports GET requests without a body");
    const { response, discovery, result } = await readEiaRequest(request, apiKey);
    const rows = [response.data, response.routes, response.facets].find(Array.isArray);
    const completeness = {complete: false, ...(Array.isArray(rows) ? {returned: rows.length} : {}),
      truncation: {reason: "unknown" as const, detail: "One EIA metadata/facet/data response does not establish complete history, facet coverage or an atomic snapshot; inspect native totals and warnings."}};
    if (!discovery) return {status: result.status, completeness, upstreamTotal: null,
      data: {...result.data, _mcp: {completeness, provenance: result.provenance}}};
    if (request.path === "/discovery/facet" && !Array.isArray(response.facets)) fail("EIA facet response is missing facets", 502, result);
    if (request.path === "/discovery/data" && !Array.isArray(response.data)) fail("This route did not return observations; inspect child routes first", 502, result);
    return {status: result.status, completeness, upstreamTotal: null,
      data: {data: result.data, provenance: result.provenance, _mcp: {completeness},
      note: "Provider envelope retained except credentials. Warnings and totals may indicate incomplete results; one response is not a complete or atomic dataset. Use metadata for available frequencies, columns, units and child routes."}};
  };
}

async function readEiaRequest(request: Parameters<ApiFetchFn>[0], apiKey: string | undefined) {
  const params = { ...(request.params ?? {}) };
  const discovery = request.path.startsWith("/discovery/");
  let path = request.path;
  if (discovery) {
    path = resolveDiscoveryPath(path, params, request);
  }
  const result = await eiaJson(path, params, apiKey);
  const response = result.data.response as Record<string, unknown>;
  return { response, discovery, result };
}

function resolveDiscoveryPath(requestedPath: string, params: { [x: string]: unknown; }, request: Parameters<ApiFetchFn>[0]) {
  let path = requestedPath;
  if (!["/discovery/metadata", "/discovery/facet", "/discovery/data"].includes(path)) fail("Unknown EIA discovery operation");
  const route = eiaPath(params.route ?? (path === "/discovery/metadata" ? "/v2" : undefined));
  if (/\/(?:data|facet)(?:\/|$)/.test(route)) fail("route must identify a metadata node, without /data or /facet");
  delete params.route;
  if (path === "/discovery/facet") {
    if (typeof params.facet !== "string" || !/^[A-Za-z0-9_-]{1,100}$/.test(params.facet)) fail("facet must be an identifier from dataset metadata");
    path = `${route}/facet/${params.facet}`;
    delete params.facet;
  } else path = request.path === "/discovery/data" ? `${route}/data` : route;
  if (request.path !== "/discovery/data" && Object.keys(params).length) fail("Metadata/facet discovery accepts only route and, for facets, facet");
  if (request.path === "/discovery/data") {
    if (!Object.keys(params).some(key => /^data\[(?:\d*)\]$/.test(key))) fail("Select data[] columns from dataset metadata");
    params.length ??= 100;
    for (const [key, min, max] of [["length", 1, 5000], ["offset", 0, Number.MAX_SAFE_INTEGER]] as const) {
      const value = params[key];
      if (value !== undefined && (typeof value !== "number" || !Number.isSafeInteger(value) || value < min || value > max)) fail(`Invalid ${key}`);
    }
  }
  return path;
}
