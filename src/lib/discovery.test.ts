import {afterEach, expect, it, vi} from "vitest";
import {createEiaApiFetch} from "./api-adapter";
import {discoveryWorkflows} from "../spec/discovery";
const key = "fixture-EIA-key-not-real";
const api = createEiaApiFetch(key);
const route = "/v2/electricity/retail-sales";
// Synthetic, reduced contract fixture based on EIA technical documentation; not a live capture.
const metadata = {response: {id: "retail-sales", frequency: [{id: "monthly", format: "YYYY-MM"}], facets: [{id: "stateid"}, {id: "sectorid"}], data: {price: {units: "cents per kilowatthour"}}, startPeriod: "2001-01", endPeriod: "2026-06", unknown: {preserve: true}}, request: {command: route, params: {api_key: key}}, apiVersion: "2.1.12"};
const query = {method: "GET" as const, path: "/discovery/metadata", params: {route}};
function mock(value: unknown = metadata) { vi.stubGlobal("fetch", vi.fn().mockImplementation(() => new Response(JSON.stringify(value)))); }
afterEach(() => vi.unstubAllGlobals());
it("discovers leaf metadata while removing key echoes from returned data and provenance", async () => {
  mock(); const result = await api(query);
  const url = new URL(String(vi.mocked(fetch).mock.calls[0][0]));
  expect(url.origin).toBe("https://api.eia.gov"); expect(url.pathname).toBe(route); expect(url.searchParams.get("api_key")).toBe(key);
  expect(result.data).toMatchObject({data: {response: metadata.response, request: {params: {}}, apiVersion: "2.1.12"}, provenance: {source_url: `https://api.eia.gov${route}`, redacted_json_sha256: expect.stringMatching(/^[a-f0-9]{64}$/)}});
  expect(JSON.stringify(result)).not.toContain(key);
});
it("defaults to root metadata without confusing parent routes with observations", async () => {
  mock({response: {routes: [{id: "electricity"}]}}); expect((await api({...query, params: {}})).data).toMatchObject({data: {response: {routes: [{id: "electricity"}]}}});
  expect(new URL(String(vi.mocked(fetch).mock.calls[0][0])).pathname).toBe("/v2");
});
it("uses singular facet and preserves IDs with leading zeroes and provider totals", async () => {
  const response = {totalFacets: "20", facets: [{id: "001", name: "fixture", alias: "label"}]}; mock({response});
  expect((await api({...query, path: "/discovery/facet", params: {route, facet: "stateid"}})).data).toMatchObject({data: {response}});
  expect(new URL(String(vi.mocked(fetch).mock.calls[0][0])).pathname).toBe(`${route}/facet/stateid`);
});
it("queries discovered leaves with repeated bracket parameters and preserves values/units/warnings", async () => {
  const response = {total: "5001", data: [{price: "9007199254740993.01", "price-units": "cents per kilowatthour", period: "2026-01", nullable: null}]};
  mock({response, warning: "parameter out of range"});
  const result = await api({...query, path: "/discovery/data", params: {route, "data[]": ["price", "revenue"], "facets[stateid][]": ["CO", "CA"], offset: 0}});
  const url = new URL(String(vi.mocked(fetch).mock.calls[0][0]));
  expect(url.pathname).toBe(`${route}/data`); expect(url.searchParams.has("route")).toBe(false); expect(url.searchParams.getAll("data[]")).toEqual(["price", "revenue"]); expect(url.searchParams.getAll("facets[stateid][]")).toEqual(["CO", "CA"]); expect(url.searchParams.get("length")).toBe("100");
  expect(result.data).toMatchObject({data: {response, warning: "parameter out of range"}});
});
it.each(["https://evil.test/v2", "/v2/../secret", "/v2/a%2fb", "/v2/a?api_key=bad", "/v2/a#x", "/v2/a/data", "/v2/a/facet/x"])("rejects unsafe or non-metadata route %s before fetching", async route => {
  mock(); await expect(api({...query, params: {route}})).rejects.toThrow(); expect(fetch).not.toHaveBeenCalled();
});
it.each([{facet: "../x"}, {facet: "sectorid", offset: 1}, {facet: "sectorid", Api_key: "bad"}])("rejects invalid facet arguments %#", async params => {
  mock(); await expect(api({...query, path: "/discovery/facet", params: {route, ...params}})).rejects.toThrow(); expect(fetch).not.toHaveBeenCalled();
});
it.each([{length: 5001}, {offset: -1}, {length: 1.2}, {length: "100"}])("rejects invalid data pagination %#", async params => {
  mock(); await expect(api({...query, path: "/discovery/data", params: {route, "data[]": "price", ...params}})).rejects.toThrow(); expect(fetch).not.toHaveBeenCalled();
});
it("rejects missing columns and observations requested from a parent", async () => {
  mock({response: {routes: []}});
  await expect(api({...query, path: "/discovery/data", params: {route}})).rejects.toThrow("columns");
  await expect(api({...query, path: "/discovery/data", params: {route, "data[]": "price"}})).rejects.toThrow("child routes");
});
it("preserves legacy envelopes and removes nested key echoes and reflected secret strings", async () => {
  mock({response: {data: [{value: "001"}], nested: {API_KEY: key}, note: `url?api_key=${key}`}, request: metadata.request});
  const result = await api({...query, path: `${route}/data`, params: {"data[]": "price"}});
  expect(result.data).toMatchObject({response: {data: [{value: "001"}], nested: {}, note: "url?api_key=[REDACTED]"}}); expect(JSON.stringify(result)).not.toContain(key);
});
it("prevents credential override on legacy paths", async () => { mock(); await expect(api({...query, path: `${route}/data`, params: {api_key: "bad"}})).rejects.toThrow("credentials"); expect(fetch).not.toHaveBeenCalled(); });
it("does not reuse another adapter's key", async () => {
  mock(); await expect(createEiaApiFetch()(query)).rejects.toMatchObject({status: 401}); expect(fetch).not.toHaveBeenCalled();
  await api(query); await createEiaApiFetch("second-fixture-key")(query); await api(query);
  expect(vi.mocked(fetch).mock.calls.map(c => new URL(String(c[0])).searchParams.get("api_key"))).toEqual([key, "second-fixture-key", key]);
});
it.each([400, 401, 429, 500])("does not reflect credential-bearing HTTP %i bodies", async status => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(key, {status})));
  await expect(api(query)).rejects.toMatchObject({status, message: `EIA HTTP ${status}`});
});
it("does not reflect network errors or successful HTTP API errors", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error(key))); await expect(api(query)).rejects.toThrow("EIA request failed");
  mock({error: key, code: 400}); await expect(api(query)).rejects.toThrow("EIA reported an API error");
});
it("bounds bytes and sanitizes invalid JSON", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response("x".repeat(4 * 1024 * 1024 + 1))).mockResolvedValueOnce(new Response(key)));
  await expect(api(query)).rejects.toThrow("4 MiB"); await expect(api(query)).rejects.toThrow("invalid JSON");
});
it.each([[], null, {request: {}}, {response: []}])("rejects invalid envelopes %#", async data => { mock(data); await expect(api(query)).rejects.toThrow(); });
const run = (get: ReturnType<typeof vi.fn>) => new Function("api", `return (async()=>{${discoveryWorkflows[1].code}})()`)({get});
it("workflow validates metadata and facet membership before querying", async () => {
  const get = vi.fn().mockResolvedValueOnce({data: metadata}).mockResolvedValueOnce({data: {response: {facets: [{id: "CO"}]}}}).mockResolvedValueOnce({data: {response: {facets: [{id: "RES"}]}}}).mockResolvedValueOnce({data: {response: {data: []}}});
  expect(await run(get)).toMatchObject({complete_history_verified: false}); expect(get).toHaveBeenLastCalledWith("/discovery/data", expect.objectContaining({"data[]": "price", length: 12}));
});
it.each([{__staged: true, data_access_id: "eia_fixture"}, {__api_error: true}, {__stage_error: true}])("workflow preserves pending metadata handles %#", async handle => {
  const get = vi.fn().mockResolvedValue(handle); expect(await run(get)).toEqual(handle); expect(get).toHaveBeenCalledTimes(1);
});
it("workflow stops for missing columns or IDs without mistaking absence for a provider error", async () => {
  const get = vi.fn().mockResolvedValueOnce({data: {response: {data: {}}}}); expect(await run(get)).toHaveProperty("query_skipped"); expect(get).toHaveBeenCalledTimes(1);
  get.mockReset().mockResolvedValueOnce({data: metadata}).mockResolvedValueOnce({data: {response: {facets: []}}}); expect(await run(get)).toHaveProperty("query_skipped"); expect(get).toHaveBeenCalledTimes(2);
});

it("keeps source hashes and colliding native metadata on legacy responses", async () => {
  const native = {response: {data: [{value: "001.000", nullable: null}], total: "5001"}, _mcp: {native: true}, warning: "bounded page"};
  mock(native);
  const result = await api({...query, path: `${route}/data`, params: {length: 1}});
  expect(result).toMatchObject({upstreamTotal: null, completeness: {complete: false, returned: 1},
    data: {_mcp: {provenance: {raw_json: JSON.stringify(native), api_version: null}}}});
});
it("retains malformed discovery envelopes as error evidence", async () => {
  mock({response: {routes: [{id: "child"}]}, warning: "native warning"});
  await expect(api({...query, path: "/discovery/data", params: {route, "data[]": "price"}})).rejects.toMatchObject({status: 502,
    data: {data: {warning: "native warning"}, provenance: {raw_json: expect.any(String)}}});
});
it("workflow recovers Unicode metadata and facet membership from staging without dropping source handles", async () => {
  const source = {...metadata.response, description: "α😀".repeat(2500)};
  const text = Array.from(JSON.stringify(source));
  const handles = ["metadata", "stateid", "sectorid"].map(id => ({__staged: true, data_access_id: id}));
  const get = vi.fn().mockResolvedValueOnce(handles[0]).mockResolvedValueOnce(handles[1]).mockResolvedValueOnce(handles[2]).mockResolvedValueOnce({page: true});
  const query = vi.fn(async (id, sql) => {
    if (sql.includes("length(")) return {results: [{n: text.length}]};
    const part = sql.match(/substr\(mcp_native_json,(\d+),4000\)/);
    if (part) return {results: [{part: text.slice(Number(part[1]) - 1, Number(part[1]) + 3999).join("")}]};
    expect(sql).toContain(id === "stateid" ? "='CO'" : "='RES'");
    return {results: [{n: 1}]};
  });
  const result = await new Function("api", `return (async()=>{${discoveryWorkflows[1].code}})()`)({get, query});
  expect(result).toEqual({metadata: handles[0], stateid: handles[1], sectorid: handles[2], page: {page: true}, complete_history_verified: false});
  expect(get).toHaveBeenCalledTimes(4);
});
it.each(["oversize", "short-read", "truncated", "malformed"])("workflow retains pending metadata when staged recovery fails (%s)", async mode => {
  const handle = {__staged: true, data_access_id: "metadata"};
  const get = vi.fn().mockResolvedValue(handle);
  const query = vi.fn().mockResolvedValueOnce({results: [{n: mode === "oversize" ? 131073 : 2}]})
    .mockResolvedValue({results: [{part: mode === "short-read" ? "{" : "xx"}], truncated: mode === "truncated"});
  const result = await new Function("api", `return (async()=>{${discoveryWorkflows[1].code}})()`)({get, query});
  expect(result).toMatchObject({metadata: handle, query_skipped: expect.any(String)});
  expect(get).toHaveBeenCalledTimes(1);
});
it.each([0, null])("workflow does not query data when staged facet is missing or unreadable (%s)", async n => {
  const handle = {__staged: true, data_access_id: "stateid"};
  const get = vi.fn().mockResolvedValueOnce({data: metadata}).mockResolvedValueOnce(handle);
  const query = vi.fn().mockResolvedValue({results: [{n}]});
  const result = await new Function("api", `return (async()=>{${discoveryWorkflows[1].code}})()`)({get, query});
  expect(result).toMatchObject({stateid: handle, query_skipped: expect.any(String)});
  expect(get).toHaveBeenCalledTimes(2);
});
