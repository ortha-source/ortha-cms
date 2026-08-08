import {
    Logger,
    type OnApplicationBootstrap,
    type Provider,
    type Type
} from '@nestjs/common';
import type { CopilotToolProvider } from '@ortha-cms/copilot-domain';
import { CopilotToolRegistry } from './tool-registry.service';

/**
 * Registers a plugin's tool providers with the copilot at bootstrap.
 *
 * **Why a runtime `register(...)` rather than binding a multi-provider token.**
 * Nest cannot merge a multi-provider across independent dynamic modules, and
 * every plugin here is one — so a second binder would silently replace the
 * first instead of joining it. `OutboxDispatcher.register` set this precedent
 * for exactly the same problem and says explicitly to prefer it.
 */
class ToolsBootstrapper implements OnApplicationBootstrap {
    private readonly logger = new Logger(ToolsBootstrapper.name);

    constructor(
        private readonly label: string,
        private readonly registry: CopilotToolRegistry | null,
        private readonly providers: readonly CopilotToolProvider[]
    ) {}

    onApplicationBootstrap(): void {
        // A deployment that doesn't register `CopilotPlugin` is a perfectly
        // normal deployment, and every binding plugin must boot without it.
        if (!this.registry) {
            return;
        }
        for (const provider of this.providers) {
            this.registry.register(provider);
        }
        this.logger.log(`Registered ${this.label} tools with the copilot.`);
    }
}

/**
 * Builds the DI provider that registers `providers` with the copilot's tool
 * registry at bootstrap. Add the result to a plugin module's `providers` array;
 * the provider types themselves must be registered there too.
 *
 * ```typescript
 * providers: [
 *     MediaCopilotToolProvider,
 *     copilotToolsRegistrar('media', MediaCopilotToolProvider)
 * ]
 * ```
 *
 * **The explicit `inject` list is the point of this helper**, not the saved
 * lines. Written as a constructor-injected class, the registry has to be an
 * `@Optional()` parameter — and a parameter typed `CopilotToolRegistry | null`
 * makes TypeScript emit `Object` for `design:paramtypes`, so Nest has no type
 * to resolve and, because the parameter is optional, quietly injects
 * `undefined` instead of failing. The result is a registrar that runs, finds no
 * registry, and returns: the copilot boots with **none of that plugin's tools**,
 * and nothing anywhere reports a problem. That bug shipped once already. A
 * factory names its dependencies as values, so there is no reflected type to
 * get wrong.
 */
export function copilotToolsRegistrar(
    label: string,
    ...providers: Type<CopilotToolProvider>[]
): Provider {
    return {
        provide: `COPILOT_TOOLS_REGISTRAR_${label.toUpperCase()}`,
        useFactory: (
            registry: CopilotToolRegistry | null,
            ...resolved: CopilotToolProvider[]
        ) => new ToolsBootstrapper(label, registry, resolved),
        inject: [{ token: CopilotToolRegistry, optional: true }, ...providers]
    };
}
