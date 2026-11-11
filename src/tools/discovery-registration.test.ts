import {afterEach, expect, it, vi} from "vitest";
import {McpServer} from "@bio-mcp/shared/mcp";
import {createApiProxyTool} from "@bio-mcp/shared/tools/api-proxy";
import {registerCodeMode} from "./code-mode";
import {registerGetSchema} from "./get-schema";
import {registerQueryData} from "./query-data";
import {eiaCatalog} from "../spec/catalog";
import {createEiaApiFetch} from "../lib/api-adapter";
const json = (data: unknown) => new Response(JSON.stringify(data), {headers: {"content-type": "application/json"}});
afterEach(() => vi.unstubAllGlobals());
it("registers both aliases and returns both fields on keyless errors", async () => {
  const server = new McpServer({name: "fixture", version: "1"});
  registerCodeMode(server, {CODE_MODE_LOADER: {get: () => ({})}} as unknown as Parameters<typeof registerCodeMode>[1]);
  registerQueryData(server, {}); registerGetSchema(server, {});
  const tools = (server as unknown as {_registeredTools: Record<string, {handler: (args: unknown, extra: unknown) => Promise<unknown>}>})._registeredTools;
  for (const suffix of ["search", "execute", "query_data", "get_schema"]) { expect(tools[`eia_${suffix}`]).toBeDefined(); expect(tools[`mcp_eia_${suffix}`]).toBeDefined(); }
  expect(await tools.eia_search.handler({query: "metadata", category: "workflows", max_results: 5}, {})).toMatchObject({content: expect.any(Array), structuredContent: {success: true}});
  expect(await tools.mcp_eia_query_data.handler({data_access_id: "eia_fixture", sql: "SELECT 1"}, {})).toMatchObject({isError: true, content: expect.any(Array), structuredContent: expect.any(Object)});
});
it("stages complete metadata and native string values after key redaction", async () => {
  const raw = {response: {data: [{price: "001.001", "price-units": "native unit"}], total: "1000", description: "α".repeat(20000)}, warning: "partial", request: {params: {api_key: "fixture-key"}}};
  vi.stubGlobal("fetch", vi.fn().mockImplementation(() => json(raw)));
  const stored: unknown[] = [];
  const namespace = {idFromName: (name: string) => name, get: () => ({fetch: async (request: Request) => {
    if (new URL(request.url).pathname === "/process") {
      stored.push((await request.json() as {data: unknown}).data);
      return json({success: true, tables_created: ["observations"], total_rows: 1, input_rows: 1, table_row_counts: {observations: 1}});
    }
    return json({success: true, schema: {tables: {observations: {columns: [{name: "price"}]}}}});
  }})} as unknown as DurableObjectNamespace;
  const proxy = createApiProxyTool({apiFetch: createEiaApiFetch("fixture-key"), catalog: eiaCatalog, doNamespace: namespace, stagingPrefix: "eia", maxInlineBytes: 30 * 1024});
  const result = await proxy.handler({method: "GET", path: "/discovery/data", params: {route: "/v2/electricity/retail-sales", "data[]": "price"}}, {sql: () => []});
  expect(result).toMatchObject({__staged: true, data_access_id: expect.any(String)});
  expect(JSON.parse(stored[0] as string)).toMatchObject({data: {response: raw.response, warning: "partial", request: {params: {}}}, provenance: {redacted_json_sha256: expect.any(String)}});
  expect(JSON.stringify(stored)).not.toContain("fixture-key");
  expect(new TextEncoder().encode(JSON.stringify(result)).byteLength).toBeLessThan(100000);
});
