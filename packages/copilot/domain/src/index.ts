export type {
    JsonSchema,
    ModelTool,
    TextBlock,
    ToolUseBlock,
    ToolResultBlock,
    ModelContentBlock,
    ModelMessage
} from './lib/model/model-message';
export type { ModelCapabilities } from './lib/model/model-capabilities';
export {
    SUPPORTED_BASELINE,
    baselineShortfalls,
    meetsSupportedBaseline
} from './lib/model/model-capabilities';
export type { BaselineShortfall } from './lib/model/model-capabilities';
export type {
    ModelRequest,
    ModelChoice,
    ModelUsage,
    ModelStopReason,
    TextDeltaEvent,
    ToolCallEvent,
    DoneEvent,
    ModelStreamEvent,
    ModelProvider,
    ModelRunContext,
    ModelRegistry,
    ModelResolver
} from './lib/model/model-provider';
export { MODEL_REGISTRY, MODEL_RESOLVER } from './lib/model/model-provider';
export { isAbortError, abortedEvent } from './lib/model/abort';
export { resolveModel } from './lib/model/resolve-model';
export { UnknownModelProviderError } from './lib/errors/unknown-model-provider.error';
export { UnknownModelError } from './lib/errors/unknown-model.error';

// --- the tool seam (phase 1) ---
export type {
    ToolSpec,
    ToolContext,
    ToolEffect,
    ToolPermissionKey
} from './lib/tools/tool-spec';
export { COPILOT_TOOL_PROVIDER } from './lib/tools/tool-provider';
export type { CopilotToolProvider } from './lib/tools/tool-provider';
export { validateToolInput } from './lib/tools/validate-tool-input';
export type { ToolInputValidation } from './lib/tools/validate-tool-input';
export { resolveCapabilityProfile } from './lib/tools/capability-profile';
export type {
    CapabilityProfile,
    CopilotActor,
    ResolveCapabilityProfileInput,
    WithheldReason,
    WithheldTool,
    WorkspaceCopilotPolicy
} from './lib/tools/capability-profile';

// --- the run (phase 1) ---
export { DEFAULT_RUN_LIMITS, RUN_STOP_EXPLANATIONS } from './lib/run/run-limits';
export type { RunLimits, RunStopReason } from './lib/run/run-limits';
export type {
    CopilotRunEvent,
    RunStartedEvent,
    RunTextDeltaEvent,
    RunToolCallEvent,
    RunToolResultEvent,
    RunDoneEvent,
    RunErrorEvent
} from './lib/run/run-event';
export { fenceUntrusted, UNTRUSTED_DATA_RULE } from './lib/run/untrusted';
