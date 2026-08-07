import { DynamicModule, Module } from '@nestjs/common';
import {
    MODEL_REGISTRY,
    MODEL_RESOLVER,
    type ModelResolver
} from '@ortha-cms/copilot-domain';
import { DatabaseModule } from '@ortha-cms/database';
import { COPILOT_CONFIG } from './copilot.tokens';
import {
    buildModelRegistry,
    type ProviderRegistration
} from './infrastructure/model-registry';
import type { CopilotPluginConfig } from './types/copilot-config';
import { CapabilityProfileService } from './chat/application/capability-profile.service';
import { ContentTypeSummaryService } from './chat/application/content-type-summary.service';
import { RunEngine } from './chat/application/run-engine.service';
import { CopilotToolRegistry } from './chat/application/tool-registry.service';
import { ConversationRepository } from './chat/infrastructure/persistence/conversation.repository';
import { CreateRunController } from './chat/http/controllers/create-run.controller';
import { GetConversationController } from './chat/http/controllers/get-conversation.controller';
import { ListConversationsController } from './chat/http/controllers/list-conversations.controller';
import { ListModelsController } from './chat/http/controllers/list-models.controller';

/** Options `CopilotModule.forRoot` binds into DI. */
export interface CopilotModuleOptions {
    /** The model backends this deployment offers, in preference order. */
    providers: readonly ProviderRegistration[];
    /** Optional custom handler picking a provider per run. */
    resolve?: ModelResolver;
    /** Host config (kill switch + default provider + connection settings). */
    config: CopilotPluginConfig;
}

/**
 * NestJS module for the copilot plugin. Registered globally, like every other
 * plugin module here, so a tool-binding plugin can inject
 * {@link CopilotToolRegistry} without an explicit import.
 *
 * Phase 1 adds the chat vertical slice on top of phase 0's model seam: the SSE
 * run route, the bounded run engine, the capability profile, and conversation
 * persistence. The tools themselves are bound by the plugins that own the logic
 * they wrap, never by this module.
 */
@Module({})
export class CopilotModule {
    /** Creates the global dynamic module around a validated config. */
    static forRoot(options: CopilotModuleOptions): DynamicModule {
        const resolver: ModelResolver =
            options.resolve ?? (() => options.config.defaultProvider);

        return {
            module: CopilotModule,
            global: true,
            // `DatabaseModule` is global, but importing it explicitly keeps
            // this module standalone-testable.
            imports: [DatabaseModule],
            controllers: [
                CreateRunController,
                // Before `GetConversationController`: `conversations/:id` and
                // `models` can't collide (different first segments), but keep
                // the read routes grouped after the run route.
                ListModelsController,
                ListConversationsController,
                GetConversationController
            ],
            providers: [
                { provide: COPILOT_CONFIG, useValue: options.config },
                {
                    provide: MODEL_REGISTRY,
                    useValue: buildModelRegistry(options.providers)
                },
                { provide: MODEL_RESOLVER, useValue: resolver },
                CopilotToolRegistry,
                CapabilityProfileService,
                ContentTypeSummaryService,
                ConversationRepository,
                RunEngine
            ],
            exports: [
                COPILOT_CONFIG,
                MODEL_REGISTRY,
                MODEL_RESOLVER,
                // Exported so a binding plugin can inject it from its own
                // `OnApplicationBootstrap` and register its tools.
                CopilotToolRegistry
            ]
        };
    }
}
