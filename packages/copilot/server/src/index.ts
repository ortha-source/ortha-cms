export { CopilotPlugin } from './lib/utils/copilot-plugin';
export type {
    CopilotPluginOptions,
    CopilotServerPluginDefinition
} from './lib/utils/copilot-plugin';
export { CopilotModule } from './lib/copilot.module';
export type { CopilotModuleOptions } from './lib/copilot.module';
export {
    COPILOT_CONFIG,
    COPILOT_RUN_LIMITS,
    InjectCopilotConfig
} from './lib/copilot.tokens';
export type { CopilotPluginConfig } from './lib/types/copilot-config';
export { buildModelRegistry } from './lib/infrastructure/model-registry';
export type { ProviderRegistration } from './lib/infrastructure/model-registry';

// The seam a tool-binding plugin uses: inject the registry from its own
// `OnApplicationBootstrap` and call `register(...)`. The `ToolSpec` /
// `CopilotToolProvider` contracts it registers live in `@ortha-cms/copilot-domain`,
// so a binder never has to import this package's internals.
export { CopilotToolRegistry } from './lib/chat/application/tool-registry.service';
// The one-liner a binding plugin adds to its module's `providers` to register
// its tools at bootstrap. Prefer it over a hand-written registrar class — see
// its JSDoc for the `design:paramtypes` trap it exists to close.
export { copilotToolsRegistrar } from './lib/chat/application/tools-registrar';
export { ProposalApplierRegistry } from './lib/chat/application/proposal-applier.registry';
// The sibling one-liner for the plugins that own writes. A plugin binding
// propose tools must register the appliers for the kinds they produce.
export { copilotAppliersRegistrar } from './lib/chat/application/appliers-registrar';

// The run engine and its collaborators, exported for tests and for a future
// non-HTTP surface (a job runner in phase 5) that needs the loop without the
// controller.
export {
    RunEngine,
    CopilotDisabledError,
    UnknownModelChoiceError
} from './lib/chat/application/run-engine.service';
export type { StartRunInput } from './lib/chat/application/run-engine.service';
export { CapabilityProfileService } from './lib/chat/application/capability-profile.service';
export { ConversationRepository } from './lib/chat/infrastructure/persistence/conversation.repository';
export type {
    ConversationView,
    MessageView,
    ToolCallRecord
} from './lib/chat/infrastructure/persistence/conversation.repository';
export {
    buildSystemPrompt,
    SYSTEM_PROMPT_VERSION
} from './lib/chat/application/system-prompt';
export type {
    SurfaceContext,
    SystemPromptInput
} from './lib/chat/application/system-prompt';

// The Drizzle tables this plugin owns and migrates.
export * from './lib/chat/infrastructure/schema';
