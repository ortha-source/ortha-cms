import type { ChatMessage, ChatToolStep } from '../../domain/types/chat';

/**
 * What a still-running turn should say it is doing, right now.
 *
 * `after-step` names the call the run just finished, which is the whole point:
 * the transcript used to answer "what is happening?" with the word "Thinking…"
 * in every gap, including the ones where it knew exactly what had just been
 * done. `thinking` is kept for the gap where that is genuinely the only true
 * answer — before the first frame of the turn has arrived.
 */
export type TurnActivity =
    | { kind: 'thinking' }
    | { kind: 'after-step'; step: ChatToolStep };

/**
 * The line to show under a turn while it is still being written, or `null` when
 * the turn already says what it is doing.
 *
 * Four things silence it, and each is a different way the turn is already
 * speaking for itself:
 *
 * - **A running step**, which has its own spinner and its own present-tense
 *   phrase. Doubling that up with a status line saying the same words is noise.
 * - **Prose still arriving** — the newest block is text. The words *are* the
 *   status; a pulsing "thinking" under a sentence being typed contradicts it.
 * - **A failed turn**, which has an alert instead.
 * - **A permission prompt waiting for an answer**: the run is blocked on the
 *   user, not working, and saying otherwise moves their eye away from the one
 *   control that matters.
 *
 * Everything left is dead air. It used to be dead air only *some* of the time —
 * the old condition stood down for the whole turn as soon as any prose had
 * arrived, so a turn that explained itself, searched, and then thought for
 * three seconds showed a finished step and nothing else.
 */
export function turnActivity(turn: ChatMessage): TurnActivity | null {
    if (!turn.streaming || turn.error) {
        return null;
    }
    if (turn.permissions?.some((request) => !request.answered)) {
        return null;
    }
    if (
        turn.blocks.some(
            (block) => block.kind === 'step' && block.step.status === 'running'
        )
    ) {
        return null;
    }

    const newest = turn.blocks[turn.blocks.length - 1];
    if (newest?.kind === 'text' && newest.text) {
        return null;
    }

    // Searching from the end, and past a change card: a `proposal` block is
    // emitted straight after the step that produced it, so the newest block
    // after a write is the receipt rather than the call it is a receipt for.
    for (let index = turn.blocks.length - 1; index >= 0; index -= 1) {
        const block = turn.blocks[index];
        if (block.kind === 'step') {
            return { kind: 'after-step', step: block.step };
        }
    }
    return { kind: 'thinking' };
}
