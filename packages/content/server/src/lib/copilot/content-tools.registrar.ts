import {
    Inject,
    Injectable,
    Logger,
    Optional,
    type OnApplicationBootstrap
} from '@nestjs/common';
import { CopilotToolRegistry } from '@ortha-cms/copilot-server';
import { ContentCopilotToolProvider } from './content-tool.provider';

/**
 * Registers the content tools with the copilot at bootstrap.
 *
 * **Why a runtime `register(...)` rather than binding a multi-provider token.**
 * Nest cannot merge a multi-provider across independent dynamic modules, and
 * every plugin here is one — so a second binder (media in phase 3) would
 * silently replace the first instead of joining it. `OutboxDispatcher.register`
 * set this precedent for exactly the same problem, and says explicitly to
 * prefer it over the multi-provider.
 *
 * `CopilotToolRegistry` is injected `@Optional()`: a deployment that doesn't
 * register `CopilotPlugin` is a perfectly normal deployment, and content must
 * boot without it.
 *
 * The explicit `@Inject(CopilotToolRegistry)` is **load-bearing**, not noise.
 * Declaring the parameter as `CopilotToolRegistry | null` makes TypeScript emit
 * `Object` for `design:paramtypes`, so Nest has no type to resolve — and
 * because the parameter is also `@Optional()`, it quietly injects `undefined`
 * instead of failing. The result is a registrar that runs, finds no registry,
 * and returns: the copilot boots with **no content tools at all**, and nothing
 * anywhere reports a problem. Naming the token restores the lookup.
 */
@Injectable()
export class ContentCopilotToolsRegistrar implements OnApplicationBootstrap {
    private readonly logger = new Logger(ContentCopilotToolsRegistrar.name);

    constructor(
        private readonly tools: ContentCopilotToolProvider,
        @Optional()
        @Inject(CopilotToolRegistry)
        private readonly registry: CopilotToolRegistry | null = null
    ) {}

    onApplicationBootstrap(): void {
        if (!this.registry) {
            return;
        }
        this.registry.register(this.tools);
        this.logger.log('Registered content tools with the copilot.');
    }
}
