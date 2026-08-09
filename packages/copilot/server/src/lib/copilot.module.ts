import { DynamicModule, Module } from '@nestjs/common';
import {
    MODEL_REGISTRY,
    MODEL_RESOLVER,
    type ModelResolver
} from '@ortha-cms/copilot-domain';
import { DatabaseModule } from '@ortha-cms/database';
import { ToolsModule } from '@ortha-cms/tools-server';
import { COPILOT_CONFIG } from './copilot.tokens';
import {
    buildModelRegistry,
    type ProviderRegistration
} from './infrastructure/model-registry';
import type { CopilotPluginConfig } from './types/copilot-config';
import { CapabilityProfileService } from './chat/application/capability-profile.service';
import { DecideProposalService } from './chat/application/decide-proposal.service';
import { ToolPermissionBroker } from './chat/application/tool-permission.broker';
import { ProposalApplierRegistry } from './chat/application/proposal-applier.registry';
import { ContentTypeSummaryService } from './chat/application/content-type-summary.service';
import { RunEngine } from './chat/application/run-engine.service';
import { ConversationRepository } from './chat/infrastructure/persistence/conversation.repository';
import { ProposalRepository } from './chat/infrastructure/persistence/proposal.repository';
import { CreateRunController } from './chat/http/controllers/create-run.controller';
import { GetConversationController } from './chat/http/controllers/get-conversation.controller';
import { ListConversationsController } from './chat/http/controllers/list-conversations.controller';
import { ListModelsController } from './chat/http/controllers/list-models.controller';
import { ProposalsController } from './chat/http/controllers/proposals.controller';
import { ToolPermissionController } from './chat/http/controllers/tool-permission.controller';

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
            // `ToolsModule` carries the shared tool registry — the same
            // catalogue the MCP endpoint serves. Imported rather than provided
            // so a deployment running the copilot *without* MCP still has one,
            // and one running both has exactly one.
            imports: [DatabaseModule, ToolsModule],
            controllers: [
                CreateRunController,
                // Before `GetConversationController`: `conversations/:id` and
                // `models` can't collide (different first segments), but keep
                // the read routes grouped after the run route.
                ListModelsController,
                ListConversationsController,
                // Before `GetConversationController`, whose `conversations/:id`
                // is the only wildcard here — Express matches in declaration
                // order, so the literal-prefixed routes go first.
                ProposalsController,
                // Before `GetConversationController` for the same reason as
                // the others: its `conversations/:id` is the only wildcard, and
                // Express matches in declaration order.
                ToolPermissionController,
                GetConversationController
            ],
            providers: [
                { provide: COPILOT_CONFIG, useValue: options.config },
                {
                    provide: MODEL_REGISTRY,
                    useValue: buildModelRegistry(options.providers)
                },
                { provide: MODEL_RESOLVER, useValue: resolver },
                CapabilityProfileService,
                ContentTypeSummaryService,
                ConversationRepository,
                ProposalRepository,
                ProposalApplierRegistry,
                DecideProposalService,
                ToolPermissionBroker,
                RunEngine
            ],
            exports: [
                COPILOT_CONFIG,
                MODEL_REGISTRY,
                MODEL_RESOLVER,
                // Exported so the plugins that own writes can register their
                // proposal appliers. Tools go to the shared `ToolRegistry` in
                // `@ortha-cms/tools-server`, which the MCP module provides.
                ProposalApplierRegistry
            ]
        };
    }
}
