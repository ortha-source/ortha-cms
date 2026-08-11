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
    WithheldTool
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
    RunPermissionRequestEvent,
    ToolPermissionDecision,
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

// Attachments — the port the run engine reads a turn's attached files through,
// inverted like the applier so this package still knows no plugin exists.
export { COPILOT_ATTACHMENT_RESOLVER } from './lib/attachments/attachment';
export type {
    AttachmentRef,
    AttachmentResolver
} from './lib/attachments/attachment';

// --- skills ---
//
// Reusable instruction packets a run can be given. Two sources (the host's
// config and the CMS) produce one catalogue; the merge rule and the shape
// checks are pure, so both the server's write routes and its boot-time
// validation read the same definition of "valid".
export {
    MAX_RUN_SKILLS,
    MAX_SKILL_DESCRIPTION_LENGTH,
    MAX_SKILL_INSTRUCTIONS_LENGTH,
    MAX_SKILL_NAME_LENGTH,
    MAX_SKILL_SUMMARIES,
    MAX_SKILL_TITLE_LENGTH,
    SKILL_NAME_PATTERN,
    toSkillRef,
    validateSkillShape
} from './lib/skills/skill';
export type {
    Skill,
    SkillDefinition,
    SkillMode,
    SkillRef,
    SkillSource
} from './lib/skills/skill';
export { buildSkillRegistry, mergeSkills } from './lib/skills/skill-registry';
export type { SkillRegistry } from './lib/skills/skill-registry';
