import type { ModelContentBlock, ModelMessage } from './model-message';

/**
 * Repairs a persisted transcript into turns both wire formats accept.
 *
 * A run is stored as **one row per turn** — the assistant row holds everything
 * the run produced, text and `tool_use` and `tool_result` blocks together, in
 * the order they happened. That is the right shape for the transcript read (the
 * panel renders a turn as one message, tool activity included) and the wrong
 * shape for the model: Anthropic requires a `tool_result` to ride on a **user**
 * turn immediately after the assistant turn that asked for it, and rejects the
 * request outright — `tool_result blocks can only be in user messages` — if it
 * does not. The OpenAI adapter hides the same data defect, because it emits a
 * `role: 'tool'` item per result block and never looks at the turn's role.
 *
 * So the repair happens on the way **out**, here, rather than by changing what
 * is written: it fixes the rows already in the database, and the stored shape
 * stays the one the transcript UI reads.
 *
 * Two things are fixed:
 *
 * 1. **Roles.** A row is split at each run of `tool_result` blocks, so the
 *    persisted `[text, tool_use, tool_result, text, tool_use, tool_result]`
 *    replays as `assistant / user / assistant / user`, one pair per step, with
 *    each result group in the message directly after the uses it answers.
 * 2. **Unpaired blocks.** A run that was aborted or that failed mid-step
 *    persists `tool_use` blocks whose tools never ran, and so has no result to
 *    match them. That is a second 400 on replay, so a `tool_use` with no
 *    `tool_result` anywhere in the transcript is dropped — as is a
 *    `tool_result` with no `tool_use`. A message left with no blocks at all
 *    goes with them; an empty `content` is rejected too.
 *
 * Pure and total: the input is never mutated, and any transcript maps to a
 * valid one.
 */
export function normalizeTranscript(
    messages: readonly ModelMessage[]
): ModelMessage[] {
    const turns = messages.flatMap(splitAtToolResults);
    const paired = pairedToolIds(turns);
    return turns
        .map((turn) => ({
            role: turn.role,
            content: turn.content.filter((block) => isPaired(block, paired))
        }))
        .filter((turn) => turn.content.length > 0);
}

/**
 * Splits one stored turn wherever it crosses between tool results and anything
 * else. The results become `user` turns; every other run keeps the row's own
 * role.
 */
function splitAtToolResults(message: ModelMessage): ModelMessage[] {
    const turns: ModelMessage[] = [];
    let buffer: ModelContentBlock[] = [];
    let bufferIsResults = false;

    const flush = () => {
        if (buffer.length === 0) return;
        turns.push({
            role: bufferIsResults ? 'user' : message.role,
            content: buffer
        });
        buffer = [];
    };

    for (const block of message.content) {
        const isResult = block.type === 'tool_result';
        // Flush *before* reclassifying, so the run being closed is written out
        // under the role it was collected as.
        if (buffer.length > 0 && isResult !== bufferIsResults) flush();
        bufferIsResults = isResult;
        buffer.push(block);
    }
    flush();

    return turns;
}

/** The tool-call ids that have both a `tool_use` and a `tool_result`. */
function pairedToolIds(turns: readonly ModelMessage[]): ReadonlySet<string> {
    const uses = new Set<string>();
    const results = new Set<string>();
    for (const turn of turns) {
        for (const block of turn.content) {
            if (block.type === 'tool_use') uses.add(block.id);
            else if (block.type === 'tool_result') results.add(block.toolUseId);
        }
    }
    return new Set([...uses].filter((id) => results.has(id)));
}

/** Whether a block survives the pairing rule. Text always does. */
function isPaired(
    block: ModelContentBlock,
    paired: ReadonlySet<string>
): boolean {
    if (block.type === 'tool_use') return paired.has(block.id);
    if (block.type === 'tool_result') return paired.has(block.toolUseId);
    return true;
}
