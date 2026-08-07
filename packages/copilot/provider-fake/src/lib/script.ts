import { DEV_MODE_REPLY, type FakeTurn } from './config';

/** Hands out the next scripted turn, or the dev-mode reply. */
export interface ScriptReader {
    /** The turn for the next model call. Throws once a script runs out. */
    next(): FakeTurn;
    /** Rewinds to the first turn. */
    reset(): void;
}

/**
 * Creates the reader behind the provider's two modes.
 *
 * - **No script (dev mode):** the same canned reply, forever. A contributor
 *   running the admin offline never hits an end.
 * - **Script supplied (test mode):** turns are consumed in order, and running
 *   past the end **throws**. Silently inventing a turn would let a test assert
 *   the wrong number of model calls and still pass.
 */
export function createScriptReader(script?: readonly FakeTurn[]): ScriptReader {
    let index = 0;

    return {
        next(): FakeTurn {
            if (!script) {
                return { text: DEV_MODE_REPLY };
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
