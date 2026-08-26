import { UNSCRIPTED_REPLY, type FakeTurn } from './config';

/** Hands out the next scripted turn, or the unscripted reply. */
export interface ScriptReader {
    /** The turn for the next model call. Throws once a script runs out. */
    next(): FakeTurn;
    /** Rewinds to the first turn. */
    reset(): void;
}

/**
 * Creates the reader behind the provider's two modes.
 *
 * - **No script:** the same canned reply, forever. A harness constructed before
 *   a test scripts anything never hits an end.
 * - **Script supplied:** turns are consumed in order, and running past the end
 *   **throws**. Silently inventing a turn would let a test assert the wrong
 *   number of model calls and still pass.
 */
export function createScriptReader(script?: readonly FakeTurn[]): ScriptReader {
    let index = 0;

    return {
        next(): FakeTurn {
            if (!script) {
                return { text: UNSCRIPTED_REPLY };
            }
            const turn = script[index];
            if (!turn) {
                throw new Error(
                    `Fake copilot provider script exhausted: ${script.length} turn(s) scripted, ` +
                        `call ${index + 1} requested. Add a turn, or assert fewer model calls.`
                );
            }
            index += 1;
            return turn;
        },

        reset(): void {
            index = 0;
        }
    };
}
