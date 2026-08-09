import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
    CallToolRequestSchema,
    ListResourcesRequestSchema,
    ListToolsRequestSchema,
    ReadResourceRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import type { ToolRegistry } from '../application/tool-registry';
import { toToolError } from '../application/tool-error';
import type { ToolContext } from '../types/tool';

/** Identity this server reports to clients during `initialize`. */
export interface McpServerInfo {
    /** Server name shown in client UIs. */
    name: string;
    /** Server version. */
    version: string;
}

/**
 * Build the MCP protocol server for **one** authenticated request.
 *
 * Per-request rather than one long-lived instance, because the tool list is a
 * function of the caller: `tools/list` must show a `read`-scoped token a
 * different set than a `full`-scoped one, and resources are pruned to the
 * workspace's content grants. Binding the context into the handlers at
 * construction is what makes that impossible to get wrong — there is no shared
 * server whose handlers must remember to re-derive who is asking.
 *
 * The low-level `Server` is used rather than the SDK's `McpServer` helper
 * deliberately: that helper takes Zod shapes, while every schema here is
 * **generated JSON Schema** produced from the content registry at runtime.
 * Converting generated JSON Schema into Zod purely to have the SDK convert it
 * back is a lossy round-trip in service of nothing.
 */
export function buildMcpServer(
    registry: ToolRegistry,
    context: ToolContext,
    info: McpServerInfo
): Server {
    const server = new Server(info, {
        capabilities: { tools: {}, resources: {} }
    });

    server.setRequestHandler(ListToolsRequestSchema, () => ({
        tools: registry.visibleTo(context).map((tool) => ({
            name: tool.name,
            title: tool.title,
            description: tool.description,
            inputSchema: tool.inputSchema as { type: 'object' },
            annotations: {
                title: tool.title,
                readOnlyHint: tool.readOnly,
                destructiveHint: tool.destructive ?? false
            }
        }))
    }));

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const { name, arguments: args } = request.params;
        try {
            const result = await registry.call(name, args ?? {}, context);
            return {
                // Both spellings of the same value: `structuredContent` for
                // clients that parse it, and the text block for models that
                // only ever see `content`. Emitting one or the other would
                // make the tool useless to half the ecosystem.
                content: [{ type: 'text' as const, text: stringify(result) }],
                structuredContent: asStructured(result)
            };
        } catch (error) {
            const failure = toToolError(error);
            // `isError` rather than a JSON-RPC error, and this is the whole
            // point: a protocol error aborts the client's call, while an
            // `isError` result is handed back to the *model*, which can read
            // "title must be at most 200 characters" and fix its next call.
            // Refusals land here too — a model that learns it lacks
            // `content:publish` stops trying, instead of retrying blind.
            return {
                isError: true,
                content: [{ type: 'text' as const, text: stringify(failure) }]
            };
        }
    });

    server.setRequestHandler(ListResourcesRequestSchema, async () => ({
        resources: [...(await registry.resources(context))]
    }));

    server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
        const contents = await registry.readResource(
            request.params.uri,
            context
        );
        return { contents: [contents] };
    });

    return server;
}

/**
 * MCP's `structuredContent` must be a JSON **object**. Tool results are mostly
 * objects already (a list envelope, an entry); anything else is boxed under
 * `value` rather than dropped.
 */
function asStructured(result: unknown): Record<string, unknown> {
    return typeof result === 'object' &&
        result !== null &&
        !Array.isArray(result)
        ? (result as Record<string, unknown>)
        : { value: result };
}

/** Pretty-printed JSON — the text rendering a model actually reads. */
function stringify(value: unknown): string {
    return JSON.stringify(value, null, 2) ?? 'null';
}
