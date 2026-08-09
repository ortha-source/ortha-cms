import { Inject } from '@nestjs/common';

/**
 * DI tokens and their inject decorators for the MCP plugin. Kept in a
 * dependency-free module (imports only `@nestjs/common`) so providers can
 * reference them without forming an import cycle with `mcp.module.ts` — the
 * same arrangement as `copilot.tokens.ts`.
 */

/** Injection token for the resolved MCP configuration. */
export const MCP_CONFIG = Symbol('MCP_CONFIG');

/** Parameter decorator that injects the MCP configuration. */
export const InjectMcpConfig = (): ParameterDecorator => Inject(MCP_CONFIG);
