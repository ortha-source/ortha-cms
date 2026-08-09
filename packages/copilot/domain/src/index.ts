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

// --- the tool seam ---
//
// `ToolSpec` / `ToolContext` / `COPILOT_TOOL_PROVIDER` are gone: the tool
// contract and its registry are shared with the MCP endpoint and live in
// `@ortha-cms/tools-server` (ADR-0006 §2, and the amendment to ADR-0005 §3).
// What stays here is what genuinely belongs to a *framework-free core* — the
// offer-time policy and the input validator, neither of which needs Nest, a
// registry, or a permission enum to be correct.
export { validateToolInput } from './lib/tools/validate-tool-input';
export type { ToolInputValidation } from './lib/tools/validate-tool-input';
export { resolveCapabilityProfile } from './lib/tools/capability-profile';
export type {
    AuthorizableTool,
    CapabilityProfile,
    CopilotActor,
    ResolveCapabilityProfileInput,
    ToolPermissionKey,
    WithheldReason,
    WithheldTool,
    WorkspaceCopilotPolicy
} from './lib/tools/capability-profile';

// --- the run (phase 1) ---
export {
    DEFAULT_RUN_LIMITS,
    RUN_STOP_EXPLANATIONS
} from './lib/run/run-limits';
export type { RunLimits, RunStopReason } from './lib/run/run-limits';
export type {
    CopilotRunEvent,
    RunStartedEvent,
    RunTextDeltaEvent,
    RunToolCallEvent,
    RunToolResultEvent,
    RunProposalEvent,
    RunDoneEvent,
    RunErrorEvent
} from './lib/run/run-event';
export { fenceUntrusted, UNTRUSTED_DATA_RULE } from './lib/run/untrusted';

// --- proposals (phase 3) ---
export { isProposalDraft } from './lib/proposals/proposal';
export type {
    ProposalChange,
    ProposalDraft,
    ProposalStatus,
    ProposalTarget
} from './lib/proposals/proposal';
export { COPILOT_PROPOSAL_APPLIER } from './lib/proposals/proposal-applier';
export type {
    ProposalActor,
    ProposalApplier,
    ProposalApplyResult
} from './lib/proposals/proposal-applier';
