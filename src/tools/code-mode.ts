import type { McpServer } from "@bio-mcp/shared/mcp";
import { createSearchTool } from "@bio-mcp/shared/codemode/search-tool";
import { createExecuteTool } from "@bio-mcp/shared/codemode/execute-tool";
import { eiaCatalog } from "../spec/catalog";
import { createEiaApiFetch } from "../lib/api-adapter";
import { eiaResponse, EIA_SOURCE } from "../lib/tool-result";

interface CodeModeEnv {
  EIA_DATA_DO: DurableObjectNamespace;
  CODE_MODE_LOADER: WorkerLoader;
  EIA_API_KEY?: string;
}

export function registerCodeMode(server: McpServer, env: CodeModeEnv): void {
  const apiFetch = createEiaApiFetch(env.EIA_API_KEY);
  const registrar = { tool: (...args: unknown[]) => {
    const [name, ...rest] = args;
    const register = server.tool.bind(server) as (...values: unknown[]) => void;
    const handler = rest.pop() as (input: unknown, extra: unknown) => ReturnType<typeof eiaResponse>;
    for (const alias of [String(name), `mcp_${String(name)}`]) register(alias, ...rest,
      (input: unknown, extra: unknown) => eiaResponse(() => handler(input, extra), env, alias, extra, input));
  } };

  const searchTool = createSearchTool({
    prefix: "eia",
    catalog: eiaCatalog,
  });
  searchTool.register(registrar);

  const executeTool = createExecuteTool({
    prefix: "eia",
    // Verifiable provenance: eia_execute results carry a _meta.citation.
    source: EIA_SOURCE,
    catalog: eiaCatalog,
    apiFetch,
    preserveApiErrors: true,
    maxInlineBytes: 30 * 1024,
    stagingThreshold: 30 * 1024,
    timeout: 90_000,
    doNamespace: env.EIA_DATA_DO,
    loader: env.CODE_MODE_LOADER,
  });
  executeTool.register(registrar);
}
