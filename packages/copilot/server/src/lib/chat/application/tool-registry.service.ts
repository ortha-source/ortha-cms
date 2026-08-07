import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import {
    COPILOT_TOOL_PROVIDER,
    type CopilotToolProvider,
    type ToolSpec
} from '@ortha-cms/copilot-domain';

/**
 * The copilot's tool catalogue — every tool the bound plugins offer for a
 * workspace.
 *
 * Tool bindings live with their owners (content tools in `content/server`,
 * media tools in `media/server`), so this package never imports a feature
 * plugin ([`docs/design/copilot.md`](../../../../../../docs/design/copilot.md) §4).
 *
 * **Registration is at runtime, not by multi-provider**, following the
 * precedent `OutboxDispatcher.register` set for exactly this problem: Nest
 * cannot merge a multi-provider token across independent dynamic modules, and
 * every plugin here is one. A binding plugin injects this registry from its own
 * `OnApplicationBootstrap` and calls {@link register}. The
 * {@link COPILOT_TOOL_PROVIDER} injection below is honoured too, so a host that
 * binds exactly one provider statically still works.
 */
@Injectable()
export class CopilotToolRegistry {
    private readonly logger = new Logger(CopilotToolRegistry.name);

    /** Providers registered at runtime via {@link register}. */
    private readonly registered: CopilotToolProvider[] = [];

    constructor(
        @Optional()
        @Inject(COPILOT_TOOL_PROVIDER)
        private readonly injected: CopilotToolProvider[] | null = null
    ) {}

    /** Registers a tool provider. Called by binding plugins at bootstrap. */
    register(provider: CopilotToolProvider): void {
        this.registered.push(provider);
    }

    /** Every registered provider, static bindings first. */
    private providers(): CopilotToolProvider[] {
        const injected = this.injected
            ? Array.isArray(this.injected)
                ? this.injected
                : [this.injected]
            : [];
        return [...injected, ...this.registered];
    }

    /**
     * Every tool on offer for `workspaceId`, in registration order.
     *
     * A provider that throws is **skipped, not fatal**: one plugin failing to
     * describe its tools degrades that run's catalogue rather than failing the
     * chat — the same isolation rule ADR-0005 §8 sets for connectors, applied
     * to in-repo binders because the failure mode is identical.
     */
    async tools(workspaceId: string): Promise<ToolSpec[]> {
        const collected: ToolSpec[] = [];
        for (const provider of this.providers()) {
            try {
                collected.push(...(await provider.tools(workspaceId)));
            } catch (error) {
                this.logger.error(
                    'A copilot tool provider failed to describe its tools; ' +
                        'continuing without them.',
                    error instanceof Error ? error.stack : String(error)
                );
            }
        }
        return collected;
    }
}
