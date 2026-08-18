import type { RunLimits } from '@ortha-cms/copilot-domain';

/**
 * The copilot plugin's host-supplied config.
 *
 * Deliberately **adapter-agnostic**: it names no provider kind and imports no
 * adapter package, so adding a Bedrock or Vertex adapter is a new package and
 * a line in the composition root — never a change here
 * ([ADR-0004](../../../../../docs/adr/0004-model-agnostic-copilot-provider.md) §2).
 *
 * Provider *connection* settings therefore live with the host, next to the
 * factories that consume them; each adapter exports its own config type. The
 * routing handler, if any, is code in the composition root rather than config.
 */
export interface CopilotPluginConfig {
    /**
     * The global kill switch. **Off by default**
     * ([ADR-0005](../../../../../docs/adr/0005-copilot-authority-model.md) §10):
     * enabling a hosted provider sends workspace content to a third party, and
     * that is an operator's decision to make explicitly.
     */
    enabled: boolean;
    /** Ceiling on a single model response, in tokens. */
    maxOutputTokens: number;
    /**
     * Optional overrides for the run engine's ceilings. Omitted fields keep
     * `DEFAULT_RUN_LIMITS`.
     *
     * `maxSteps` is the one an operator reaches for first — a smaller local
     * model needs more tool round trips than a frontier one to answer the same
     * question — but raising it alone rarely helps, because all three are
     * checked in the same loop and a run that no longer runs out of steps runs
     * out of seconds instead. Move them together. Raising them costs tokens
     * rather than safety: every step is still authorized and audited, and a
     * `propose` tool still records its row before it applies anything.
     */
    limits?: Partial<RunLimits>;
}
