import type {
    ToolCallEvent,
    ToolCallStartEvent
} from '@orthacms/copilot-domain';
import type { ToolCallDelta } from './types';

/** An in-flight tool call, assembled from `arguments` fragments. */
interface PartialToolCall {
    id?: string;
    name?: string;
    args: string;
    /** Whether its `tool-call-start` has gone out. */
    announced: boolean;
}

/** Collects tool-call fragments across chunks and emits them once complete. */
export interface ToolCallAccumulator {
    /**
     * Folds one chunk's `tool_calls` deltas into the pending set, returning a
     * start for each call whose id **and** name this chunk completed.
     *
     * Both, not the name alone: the start's id must be the one `drain` hands
     * the finished call, and a call whose id never arrives is drained under a
     * fallback the start could not have known. Such a call is simply not
     * announced — it still runs.
     */
    add(deltas: readonly ToolCallDelta[]): ToolCallStartEvent[];
    /**
     * The finished calls, in `index` order, arguments parsed. Called only once
     * the stream ends — a call must reach the engine whole, never as
     * fragments.
     */
    drain(): ToolCallEvent[];
}

/**
 * Parses a tool call's accumulated arguments. A model that emits malformed
 * JSON gets an empty object rather than crashing the run: the engine then
 * fails schema validation and returns a tool error the model can recover from,
 * which is a far better outcome than a dead stream.
 */
export function parseArgs(args: string): unknown {
    if (!args.trim()) {
        return {};
    }
    try {
        return JSON.parse(args);
    } catch {
        return {};
    }
}

/**
 * Creates an accumulator.
 *
 * The wire format streams a tool call as fragments keyed by `index`: the first
 * fragment usually carries `id` and `name`, later ones append to `arguments`.
 * Parallel calls interleave, so the index is the only thing tying a fragment
 * to its call.
 */
export function createToolCallAccumulator(): ToolCallAccumulator {
    const pending = new Map<number, PartialToolCall>();

    return {
        add(deltas: readonly ToolCallDelta[]): ToolCallStartEvent[] {
            const started: ToolCallStartEvent[] = [];
            for (const delta of deltas) {
                const existing = pending.get(delta.index) ?? {
                    args: '',
                    announced: false
                };
                const call: PartialToolCall = {
                    id: delta.id ?? existing.id,
                    name: delta.function?.name ?? existing.name,
                    args: existing.args + (delta.function?.arguments ?? ''),
                    announced: existing.announced
                };
                if (!call.announced && call.id && call.name) {
                    call.announced = true;
                    started.push({
                        type: 'tool-call-start',
                        id: call.id,
                        name: call.name
                    });
                }
                pending.set(delta.index, call);
            }
            return started;
        },

        drain(): ToolCallEvent[] {
            return [...pending]
                .sort(([left], [right]) => left - right)
                .flatMap(([index, call]) =>
                    // A fragment set that never carried a name is not a call
                    // we can dispatch; dropping it beats inventing a name.
                    call.name
                        ? [
                              {
                                  type: 'tool-call' as const,
                                  id: call.id ?? `call-${index}`,
                                  name: call.name,
                                  input: parseArgs(call.args)
                              }
                          ]
                        : []
                );
        }
    };
}
