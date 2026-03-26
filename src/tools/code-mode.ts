import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createSearchTool } from "@bio-mcp/shared/codemode/search-tool";
import { createExecuteTool } from "@bio-mcp/shared/codemode/execute-tool";
import { eiaCatalog } from "../spec/catalog";
import { createEiaApiFetch, setEiaApiKey } from "../lib/api-adapter";

interface CodeModeEnv {
    EIA_DATA_DO: DurableObjectNamespace;
    CODE_MODE_LOADER: WorkerLoader;
    EIA_API_KEY?: string;
}

export function registerCodeMode(server: McpServer, env: CodeModeEnv): void {
    if (env.EIA_API_KEY) {
        setEiaApiKey(env.EIA_API_KEY);
    }

    const apiFetch = createEiaApiFetch();

    const searchTool = createSearchTool({
        prefix: "eia",
        catalog: eiaCatalog,
    });
    searchTool.register(server as unknown as { tool: (...args: unknown[]) => void });

    const executeTool = createExecuteTool({
        prefix: "eia",
        catalog: eiaCatalog,
        apiFetch,
        doNamespace: env.EIA_DATA_DO,
        loader: env.CODE_MODE_LOADER,
    });
    executeTool.register(server as unknown as { tool: (...args: unknown[]) => void });
}
