/** Public API of @ortha-cms/mcp-server. */

export { McpPlugin } from './lib/utils/mcp-plugin';
export type {
    McpPluginOptions,
    McpServerPluginDefinition
} from './lib/utils/mcp-plugin';

export { McpModule } from './lib/mcp.module';
export { MCP_CONFIG, InjectMcpConfig } from './lib/mcp.tokens';
export type { McpPluginConfig } from './lib/types/mcp-config';

// The tool seam. A capability plugin implements `ToolProvider` and registers
// itself with the `ToolRegistry` it injects `@Optional()`; the copilot's
// in-process tool loop injects the same registry to reach the same tools.
export { ToolRegistry } from './lib/application/tool-registry';
export type { ToolProvider } from './lib/types/tool-provider';
export type {
    JsonSchema,
    ResourceContents,
    ResourceDefinition,
    ToolActor,
    ToolActorKind,
    ToolContext,
    ToolDefinition,
    ToolOutput
} from './lib/types/tool';

// Building a context is exported because the MCP endpoint is not its only
// caller — the copilot builds one for the signed-in user.
export { createToolContext } from './lib/http/tool-context';

export { toToolError } from './lib/application/tool-error';
export type { ToolError } from './lib/application/tool-error';
