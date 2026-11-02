/** The MCP front door — kill switch, identity, and the two result ceilings. */
import type { McpPluginConfig } from '@orthacms/mcp-server';

import { mcpEnabled } from '@orthacms/config';

/** The MCP front door — kill switch, identity, and the two result ceilings. */
export function mcpConfig(): McpPluginConfig {
    return {
        // Off unless `MCP_ENABLED=true` (ADR-0006): once on, any holder of a
        // `full`-scope API token can drive content CRUD from an external agent.
        enabled: mcpEnabled(),
        name: 'orthacms',
        version: '1.0.0',
        // How long one tools/call may run, and the largest serialised result.
        callTimeoutMs: 30_000,
        maxResultBytes: 4_194_304
    };
}
