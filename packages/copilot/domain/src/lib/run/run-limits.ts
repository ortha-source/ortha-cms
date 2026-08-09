/**
 * The ceilings one run may not exceed. A bounded loop is what stops a model
 * that keeps asking for tools from spending a workspace's budget on a
 * conversation nobody is reading
 * ([`docs/design/copilot.md`](../../../../../docs/design/copilot.md) §5, step 8).
 *
 * All three are enforced, and exceeding any one ends the run with a reason the
 * UI shows — never a silent stop.
 */
export interface RunLimits {
    /**
     * Model calls per run. One "step" is a model call plus any tools it asked
     * for, so this bounds the tool loop's depth, not its width.
     */
    maxSteps: number;
    /** Wall clock for the whole run, in milliseconds. */
    wallClockMs: number;
    /** Input + output tokens across every model call in the run. */
    maxTotalTokens: number;
}

/**
 * Defaults sized for the phase-1 read-only catalogue: a search-then-answer turn
 * takes two steps, and a genuinely multi-part question a handful more. Set high
 * enough not to truncate real work, low enough that a loop is caught in seconds
 * rather than minutes.
 */
export const DEFAULT_RUN_LIMITS: RunLimits = {
    maxSteps: 8,
    wallClockMs: 120_000,
    maxTotalTokens: 120_000
};

/**
 * Why a run ended. A superset of the provider's `ModelStopReason`: the model
 * reports why *it* stopped generating, while this reports why the *run* ended,
 * which includes limits the engine imposes and the model never sees.
 */
export type RunStopReason =
    /** The model produced a final answer. */
    | 'end'
    /** Hit {@link RunLimits.maxSteps}. */
    | 'max-steps'
    /** Hit {@link RunLimits.maxTotalTokens}. */
    | 'max-tokens'
    /** Hit {@link RunLimits.wallClockMs}. */
    | 'timeout'
    /** One model response was truncated by its own output ceiling. */
    | 'max-output-tokens'
    /** The provider's safety classifiers declined. */
    | 'refusal'
    /** The client disconnected, or the user cancelled. */
    | 'aborted'
    /** The run failed. The message is carried on the error event. */
    | 'error';

/** Human-readable explanation of why a run ended, for the UI to show. */
export const RUN_STOP_EXPLANATIONS: Record<RunStopReason, string> = {
    end: 'Finished.',
    'max-steps': 'Stopped after reaching the maximum number of steps.',
    'max-tokens': 'Stopped after reaching this run’s token budget.',
    timeout: 'Stopped after running longer than allowed.',
    'max-output-tokens': 'The answer was cut short by the response limit.',
    refusal: 'The model declined to answer.',
    aborted: 'Cancelled.',
    error: 'Stopped by an error.'
};
