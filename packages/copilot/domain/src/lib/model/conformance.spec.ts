import { abortedEvent } from './abort';
import {
    MODEL_PROVIDER_CONFORMANCE_CHECKS,
    runModelProviderConformance,
    type ModelProviderConformanceCase
} from './conformance';
import type {
    ModelProvider,
    ModelRequest,
    ModelStreamEvent,
    ModelUsage
} from './model-provider';
import { resolveModel } from './resolve-model';

const MODELS = ['fast', 'frontier'];
const ANSWER = 'Hello';

const request: ModelRequest = {
    messages: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }],
    maxOutputTokens: 128
};

/** The ways an adapter can break the port, one flag each. */
interface Misbehaviour {
    abortThrows?: boolean;
    abortUsage?: ModelUsage;
    extraDone?: boolean;
    omitDone?: boolean;
    toolInputAsString?: boolean;
    oneBigDelta?: boolean;
    negativeUsage?: boolean;
    ignoresUnknownModel?: boolean;
}

/**
 * A minimal in-memory `ModelProvider`, conforming by default and breakable one
 * clause at a time — the kit's own subject, because a conformance kit that
 * cannot fail is indistinguishable from one that does nothing.
 */
function stubProvider(
    mode: 'text' | 'tool',
    misbehaviour: Misbehaviour,
    onRequest: () => void
): ModelProvider {
    async function* stream(
        req: ModelRequest,
        signal?: AbortSignal
    ): AsyncIterable<ModelStreamEvent> {
        if (!misbehaviour.ignoresUnknownModel) {
            resolveModel(req.model, MODELS);
        }
        onRequest();

        if (signal?.aborted) {
            yield abortedEvent();
            return;
        }

        const deltas = misbehaviour.oneBigDelta ? [ANSWER] : ['He', 'llo'];
        if (mode === 'text') {
            for (const text of deltas) {
                if (signal?.aborted) {
                    if (misbehaviour.abortThrows) {
                        throw Object.assign(new Error('aborted'), {
                            name: 'AbortError'
                        });
                    }
                    yield {
                        type: 'done',
                        stopReason: 'aborted',
                        usage: misbehaviour.abortUsage ?? {
                            inputTokens: 0,
                            outputTokens: 0
                        }
                    };
                    return;
                }
                yield { type: 'text-delta', text };
            }
        } else {
            yield {
                type: 'tool-call',
                id: 'call_1',
                name: 'search',
                input: misbehaviour.toolInputAsString
                    ? '{"q":"launch"}'
                    : { q: 'launch' }
            };
        }

        if (misbehaviour.omitDone) {
            return;
        }
        const done: ModelStreamEvent = {
            type: 'done',
            stopReason: mode === 'tool' ? 'tool_use' : 'end',
            usage: {
                inputTokens: misbehaviour.negativeUsage ? -1 : 4,
                outputTokens: 2
            }
        };
        yield done;
        if (misbehaviour.extraDone) {
            yield done;
        }
    }

    return {
        models: () => MODELS,
        capabilities: (model?: string) =>
            Promise.resolve({
                model: resolveModel(model, MODELS),
                toolCalling: true,
                streaming: true,
                vision: false,
                contextWindow: 1_000,
                maxOutputTokens: 100
            }),
        stream
    };
}

function conformanceCase(
    misbehaviour: Misbehaviour = {}
): ModelProviderConformanceCase {
    let issued = 0;
    const count = () => {
        issued += 1;
    };
    return {
        text: () => ({
            provider: stubProvider('text', misbehaviour, count),
            request,
            answer: ANSWER
        }),
        toolCall: () => ({
            provider: stubProvider('tool', misbehaviour, count),
            request
        }),
        unknownModel: 'gpt-4o',
        requestsIssued: () => issued
    };
}

/**
 * The kit is the enforcement ADR-0004 relies on implicitly — "it lives here as
 * two functions instead of prose copy-pasted into each adapter" only works if
 * something checks the adapters used the functions. So the kit's own failure
 * modes are tested first.
 */
describe('runModelProviderConformance', () => {
    it('passes a provider that honours every clause', async () => {
        const report = await runModelProviderConformance(conformanceCase());

        expect(report).toEqual(
            Object.fromEntries(
                MODEL_PROVIDER_CONFORMANCE_CHECKS.map((check) => [check, null])
            )
        );
    });

    it('catches an abort that throws out of the stream', async () => {
        const report = await runModelProviderConformance(
            conformanceCase({ abortThrows: true })
        );

        expect(report['abort-mid-stream-ends-the-stream']).toMatch(
            /threw out of the stream/
        );
    });

    it('catches partial usage on a mid-stream abort', async () => {
        // The divergence this kit exists for: `provider-fake` reported the
        // whole reply's estimate here while both production adapters reported
        // zero, and no per-adapter spec could see it.
        const report = await runModelProviderConformance(
            conformanceCase({ abortUsage: { inputTokens: 9, outputTokens: 3 } })
        );

        expect(report['abort-mid-stream-reports-zero-usage']).toMatch(
            /the port requires zero/
        );
        expect(report['abort-mid-stream-ends-the-stream']).toBeNull();
    });

    it('catches usage smuggled in through the cache count', async () => {
        const report = await runModelProviderConformance(
            conformanceCase({
                abortUsage: {
                    inputTokens: 0,
                    outputTokens: 0,
                    cachedInputTokens: 40
                }
            })
        );

        expect(report['abort-mid-stream-reports-zero-usage']).toMatch(
            /cachedInputTokens/
        );
    });

    it('catches a second `done` event', async () => {
        const report = await runModelProviderConformance(
            conformanceCase({ extraDone: true })
        );

        expect(report['exactly-one-done-event']).toMatch(/2 `done` events/);
    });

    it('catches a stream that ends without `done`', async () => {
        const report = await runModelProviderConformance(
            conformanceCase({ omitDone: true })
        );

        expect(report['exactly-one-done-event']).toMatch(/0 `done` events/);
        expect(report['done-is-the-last-event']).toMatch(/not `done`/);
    });

    it('catches a tool call handed over as unparsed JSON', async () => {
        const report = await runModelProviderConformance(
            conformanceCase({ toolInputAsString: true })
        );

        expect(report['tool-call-is-whole-and-parsed']).toMatch(
            /requires parsed arguments/
        );
    });

    it('catches an answer delivered as one delta', async () => {
        const report = await runModelProviderConformance(
            conformanceCase({ oneBigDelta: true })
        );

        expect(report['text-deltas-reassemble-to-the-answer']).toMatch(
            /cannot exercise reassembly/
        );
    });

    it('catches a token count that is not a usable number', async () => {
        const report = await runModelProviderConformance(
            conformanceCase({ negativeUsage: true })
        );

        expect(report['usage-is-non-negative-and-finite']).toMatch(
            /finite, non-negative/
        );
    });

    it('catches an adapter that answers on the default model instead of rejecting', async () => {
        const report = await runModelProviderConformance(
            conformanceCase({ ignoresUnknownModel: true })
        );

        expect(report['unknown-model-raises-UnknownModelError']).toMatch(
            /requires UnknownModelError/
        );
        expect(report['unknown-model-costs-no-request']).toMatch(
            /still issued 1 request/
        );
    });
});
