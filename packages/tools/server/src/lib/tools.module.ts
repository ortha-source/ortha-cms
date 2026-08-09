import { Global, Module } from '@nestjs/common';
import { ToolRegistry } from './tool-registry';

/**
 * Provides the shared {@link ToolRegistry} — one instance for the whole
 * application.
 *
 * **Global, and imported rather than provided by either consumer.** The
 * registry has two of them (the MCP endpoint and the copilot's run loop) and
 * belongs to neither: if `McpModule` provided it, a deployment running the
 * copilot without MCP would have no registry and no tools; if each provided its
 * own, the two would hold different catalogues and a tool registered by a
 * capability plugin would reach whichever happened to win.
 *
 * Nest caches a static module by class, so importing this from both yields the
 * same instance — which is exactly the invariant the whole seam rests on.
 *
 * A capability plugin does **not** import this: it injects `ToolRegistry`
 * `@Optional()`, because a deployment may run neither consumer and its tools
 * then simply go unregistered.
 */
@Global()
@Module({
    providers: [ToolRegistry],
    exports: [ToolRegistry]
})
export class ToolsModule {}
