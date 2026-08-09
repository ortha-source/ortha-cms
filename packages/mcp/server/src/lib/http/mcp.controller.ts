import {
    All,
    Controller,
    Inject,
    Logger,
    Req,
    Res,
    ServiceUnavailableException
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { Public } from '@ortha-cms/identity-server';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { ToolRegistry } from '@ortha-cms/tools-server';
import { MCP_CONFIG } from '../mcp.tokens';
import { buildMcpServer } from '../protocol/build-mcp-server';
import type { McpPluginConfig } from '../types/mcp-config';
import { McpAuthService } from './mcp-auth.service';

/** The express-shaped request this controller reads. */
type McpHttpRequest = IncomingMessage & {
    body?: unknown;
    query?: Record<string, unknown>;
};

/**
 * `POST /api/v1/mcp` — the **Model Context Protocol endpoint**. An external
 * agent (Claude Desktop, Cursor, an SDK-built client) connects here and gets
 * the CMS's content tools.
 *
 * **Stateless.** Every request carries its own bearer token and is authenticated
 * from scratch, so there is no session to store, nothing to expire, and nothing
 * requiring sticky routing across replicas — the endpoint scales exactly like
 * the rest of `/api/v1`. The transport and protocol server are per-request and
 * torn down with it, which is also what lets the tool list reflect *this*
 * caller's scope.
 *
 * `GET` (the server-initiated SSE stream) and `DELETE` (session teardown) are
 * answered by the transport with a 405 in stateless mode. That is correct: both
 * exist to serve a persistent session, and there isn't one. `@All()` routes
 * them here so the answer comes from the protocol layer rather than Nest's
 * generic 404, which a client cannot interpret.
 *
 * `@Public()` opts out of the session `AuthGuard`, exactly as the `/api/v1`
 * controllers do — {@link McpAuthService} is the whole authentication story,
 * and a session cookie is not accepted.
 *
 * Excluded from the OpenAPI document: JSON-RPC over one route is not describable
 * as REST operations, and a single `POST /v1/mcp` entry in the reference would
 * tell a reader nothing about the tools. The `AGENTS.md` documents the surface.
 */
@Public()
@ApiExcludeController()
@Controller('v1/mcp')
export class McpController {
    private readonly logger = new Logger(McpController.name);

    constructor(
        private readonly auth: McpAuthService,
        private readonly registry: ToolRegistry,
        @Inject(MCP_CONFIG) private readonly config: McpPluginConfig
    ) {}

    /** Handles one JSON-RPC exchange. */
    @All()
    async handle(
        @Req() request: McpHttpRequest,
        @Res() response: ServerResponse
    ): Promise<void> {
        if (!this.config.enabled) {
            // The controller is only registered when enabled, so this is a
            // belt-and-braces guard against a future wiring change.
            throw new ServiceUnavailableException(
                'The MCP endpoint is disabled.'
            );
        }

        // Authenticate BEFORE handing anything to the protocol layer: an
        // unauthenticated caller must not be able to drive the JSON-RPC state
        // machine at all, not even to `initialize`. A plain HTTP status is also
        // the right answer here — a 401 is what tells an MCP client its
        // credential is wrong, where a JSON-RPC error would read as a working
        // connection returning a failure.
        const context = await this.auth.authenticate(
            request.headers,
            workspaceQuery(request)
        );

        const transport = new StreamableHTTPServerTransport({
            // Stateless: no session id is issued, and none is validated.
            sessionIdGenerator: undefined,
            // Answer with a single JSON body rather than opening an SSE stream.
            // Nothing here streams — a tool call returns once — and a plain
            // JSON response is what every client and every proxy handles best.
            enableJsonResponse: true
        });
        const server = buildMcpServer(this.registry, context, {
            name: this.config.name,
            version: this.config.version
        });

        // Tear both down when the exchange ends, however it ends. Without this
        // every request leaks a protocol server and its handler closures.
        response.on('close', () => {
            void transport.close();
            void server.close();
        });

        try {
            await server.connect(transport);
            // The body is already parsed by the host's express json middleware;
            // handing it over avoids the transport re-reading a consumed stream.
            await transport.handleRequest(request, response, request.body);
        } catch (error) {
            this.logger.error(
                `MCP request failed for token ${context.actor.id}`,
                error instanceof Error ? error.stack : String(error)
            );
            if (!response.headersSent) {
                response.writeHead(500, {
                    'content-type': 'application/json'
                });
                response.end(
                    JSON.stringify({
                        jsonrpc: '2.0',
                        error: {
                            code: -32603,
                            message: 'Internal server error'
                        },
                        id: null
                    })
                );
            }
        }
    }
}

/** The optional `?workspaceId=` on the endpoint URL. */
function workspaceQuery(request: McpHttpRequest): string | undefined {
    const raw = request.query?.['workspaceId'];
    return typeof raw === 'string' ? raw : undefined;
}
