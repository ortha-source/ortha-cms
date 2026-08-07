import { DynamicModule, Module } from '@nestjs/common';
import {
    MODEL_REGISTRY,
    MODEL_RESOLVER,
    type ModelResolver
} from '@ortha-cms/copilot-domain';
import { COPILOT_CONFIG } from './copilot.tokens';
import {
    buildModelRegistry,
    type ProviderRegistration
} from './infrastructure/model-registry';
import type { CopilotPluginConfig } from './types/copilot-config';

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
 * plugin module here, so a future tool-binding plugin can inject the model
 * seam without an explicit import.
 *
 * Phase 0 binds **only** the model seam and the config: no controllers, no run
 * engine, no schema. Those land with the chat vertical slice.
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
            providers: [
                { provide: COPILOT_CONFIG, useValue: options.config },
                {
                    provide: MODEL_REGISTRY,
                    useValue: buildModelRegistry(options.providers)
                },
                { provide: MODEL_RESOLVER, useValue: resolver }
            ],
            exports: [COPILOT_CONFIG, MODEL_REGISTRY, MODEL_RESOLVER]
        };
    }
}
