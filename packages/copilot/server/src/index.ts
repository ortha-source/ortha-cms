export { CopilotPlugin } from './lib/utils/copilot-plugin';
export type {
    CopilotPluginOptions,
    CopilotServerPluginDefinition
} from './lib/utils/copilot-plugin';
export { CopilotModule } from './lib/copilot.module';
export type { CopilotModuleOptions } from './lib/copilot.module';
export { COPILOT_CONFIG, InjectCopilotConfig } from './lib/copilot.tokens';
export type { CopilotPluginConfig } from './lib/types/copilot-config';
export { buildModelRegistry } from './lib/infrastructure/model-registry';
export type { ProviderRegistration } from './lib/infrastructure/model-registry';
