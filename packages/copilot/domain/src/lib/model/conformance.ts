import { UnknownModelError } from '../errors/unknown-model.error';
import type {
    DoneEvent,
    ModelProvider,
    ModelRequest,
    ModelStreamEvent
} from './model-provider';

/**
 * One armed provider plus the request that drives it — what a
 * {@link ModelProviderConformanceCase} hands the kit per scenario.
 *
 * "Armed" is the load-bearing word: an adapter over a stubbed transport has to
 * re-stub before every stream, so the kit asks for a fresh scenario per check
 * rather than reusing one provider.
 */
export interface ModelProviderScenario {
    /** A provider whose next `stream(request)` produces the scripted answer. */
    provider: ModelProvider;
    /** The request to stream. */
    request: ModelRequest;
}

/** A text scenario, plus the answer its deltas must reassemble to. */
export interface ModelProviderTextScenario extends ModelProviderScenario {
    /**
     * The complete answer the scenario streams, in at least two deltas —
     * `stream`'s contract is that concatenating every delta yields it, and a
     * single-delta answer cannot show a reassembly bug.
     */
    answer: string;
}

/**
 * What one adapter has to supply to be checked against the port.
 *
 * Every factory is called fresh per check, and may be async, so an adapter that
 * has to arm a stub (an SDK mock, a `fetch` mock) or build a provider
 * asynchronously can do it there.
 */
export interface ModelProviderConformanceCase {
    /** Arms a provider that streams `answer` as several `text-delta`s. */
    text(): ModelProviderTextScenario | Promise<ModelProviderTextScenario>;
    /** Arms a provider that streams exactly one whole tool call. */
    toolCall(): ModelProviderScenario | Promise<ModelProviderScenario>;
    /** A model id the scenarios' provider does not offer. */
    unknownModel: string;
    /**
     * Requests the provider has issued to its backing transport so far — a
     * stubbed `fetch`'s call count, an SDK mock's, or a fake's recorded calls.
     * Read before and after a rejected request, so "no request was made" is
     * checked rather than asserted in prose.
     */
    requestsIssued(): number;
}

/** The checks {@link runModelProviderConformance} runs, in order. */
export const MODEL_PROVIDER_CONFORMANCE_CHECKS = [
    'exactly-one-done-event',
    'done-is-the-last-event',
    'text-deltas-reassemble-to-the-answer',
    'usage-is-non-negative-and-finite',
    'tool-call-is-whole-and-parsed',
    'abort-before-the-first-event-ends-the-stream',
    'abort-mid-stream-ends-the-stream',
    'abort-mid-stream-reports-zero-usage',
    'models-is-not-empty',
    'capabilities-defaults-to-the-first-model',
    'unknown-model-raises-UnknownModelError',
    'unknown-model-costs-no-request'
] as const;

/** One checked clause of {@link ModelProvider}. */
export type ModelProviderConformanceCheck =
    (typeof MODEL_PROVIDER_CONFORMANCE_CHECKS)[number];

/**
 * What the kit found: `null` for a check the adapter passed, otherwise the
 * sentence naming what it did instead.
 *
 * A report rather than thrown assertions, so the kit needs no test framework —
 * `copilot-domain` imports nothing (ADR-0004 §1), and a caller in any runner
 * turns each entry into one test.
 */
export type ModelProviderConformanceReport = Record<
    ModelProviderConformanceCheck,
    string | null
>;

/**
 * Runs the {@link ModelProvider} contract against one adapter.
 *
 * The three clauses on `stream` bind every adapter and none of them was
 * enforced: each adapter was on its honour, and they had already diverged on
 * clause 3 — `provider-fake` reported a partial usage estimate on a mid-stream
 * abort where both production adapters report zero. That is invisible to a
 * per-adapter spec, because each one only ever documents what its own adapter
 * happens to do. So the clauses live here, driven identically against all
 * three.
 *
 * @example
 * ```typescript
 * describe('ModelProvider conformance', () => {
 *     let report: ModelProviderConformanceReport;
 *     beforeAll(async () => {
 *         report = await runModelProviderConformance(theCase);
 *     });
 *     it.each(MODEL_PROVIDER_CONFORMANCE_CHECKS)('%s', (check) => {
 *         expect(report[check]).toBeNull();
 *     });
 * });
 * ```
 */
export async function runModelProviderConformance(
    subject: ModelProviderConformanceCase
): Promise<ModelProviderConformanceReport> {
    return {
        ...(await checkCompletedStream(subject)),
        ...(await checkToolCall(subject)),
        ...(await checkPreflightAbort(subject)),
        ...(await checkMidStreamAbort(subject)),
        ...(await checkModelResolution(subject))
    };
}

/** The clean path: deltas, one terminal `done`, and a usable usage record. */
async function checkCompletedStream(
    subject: ModelProviderConformanceCase
): Promise<
    Pick<
        ModelProviderConformanceReport,
        | 'exactly-one-done-event'
        | 'done-is-the-last-event'
        | 'text-deltas-reassemble-to-the-answer'
        | 'usage-is-non-negative-and-finite'
    >
> {
    const scenario = await subject.text();
    const events = await drain(
        scenario.provider.stream(scenario.request)
    ).catch(asFailure);

    if (!Array.isArray(events)) {
        return {
            'exactly-one-done-event': events,
            'done-is-the-last-event': events,
            'text-deltas-reassemble-to-the-answer': events,
            'usage-is-non-negative-and-finite': events
        };
    }

    const done = events.filter(isDone);
    return {
        'exactly-one-done-event':
            done.length === 1
                ? null
                : `the stream carried ${done.length} \`done\` events; exactly one ends a stream`,
        'done-is-the-last-event':
            events.length > 0 && isDone(events[events.length - 1])
                ? null
                : `the last event was ${describe(events[events.length - 1])}, not \`done\``,
        'text-deltas-reassemble-to-the-answer': reassembles(
            events,
            scenario.answer
        ),
        'usage-is-non-negative-and-finite': done[0]
            ? usableUsage(done[0])
            : 'no `done` event to read usage from'
    };
}

/** Clause: a tool call reaches the engine once, whole, and already parsed. */
async function checkToolCall(
    subject: ModelProviderConformanceCase
): Promise<Pick<ModelProviderConformanceReport, 'tool-call-is-whole-and-parsed'>>
{
    const scenario = await subject.toolCall();
    const events = await drain(
        scenario.provider.stream(scenario.request)
    ).catch(asFailure);

    if (!Array.isArray(events)) {
        return { 'tool-call-is-whole-and-parsed': events };
    }

    const calls = events.filter((event) => event.type === 'tool-call');
    if (calls.length === 0) {
        return {
            'tool-call-is-whole-and-parsed':
                'the scenario streamed a tool call but no `tool-call` event was emitted'
        };
    }
    for (const call of calls) {
        if (call.type !== 'tool-call') continue;
        if (!call.id) {
            return {
                'tool-call-is-whole-and-parsed':
                    'a `tool-call` event carried no id, so its result cannot be echoed back'
            };
        }
        if (!call.name) {
            return {
                'tool-call-is-whole-and-parsed':
                    'a `tool-call` event carried no name'
            };
        }
        if (typeof call.input === 'string') {
            return {
                'tool-call-is-whole-and-parsed':
                    'a `tool-call` event carried its input as a JSON string; the port requires parsed arguments'
            };
        }
    }
    return { 'tool-call-is-whole-and-parsed': null };
}

/** Clause 2, at the entry point: an already-aborted signal must not throw. */
async function checkPreflightAbort(
    subject: ModelProviderConformanceCase
): Promise<
    Pick<
        ModelProviderConformanceReport,
        'abort-before-the-first-event-ends-the-stream'
    >
> {
    const scenario = await subject.text();
    const controller = new AbortController();
    controller.abort();

    const events = await drain(
        scenario.provider.stream(scenario.request, controller.signal)
    ).catch(asFailure);

    if (!Array.isArray(events)) {
        return {
            'abort-before-the-first-event-ends-the-stream': `an already-aborted signal threw out of the stream instead of ending it (${events})`
        };
    }
    return {
        'abort-before-the-first-event-ends-the-stream': abortedTerminal(events)
    };
}

/**
 * Clauses 2 and 3 where they actually bite: text has already streamed, so an
 * adapter is tempted to report what it thinks it produced.
 */
async function checkMidStreamAbort(
    subject: ModelProviderConformanceCase
): Promise<
    Pick<
        ModelProviderConformanceReport,
        | 'abort-mid-stream-ends-the-stream'
        | 'abort-mid-stream-reports-zero-usage'
    >
> {
    const scenario = await subject.text();
    const controller = new AbortController();
    const events: ModelStreamEvent[] = [];

    let failure: string | undefined;
    try {
        for await (const event of scenario.provider.stream(
            scenario.request,
            controller.signal
        )) {
            events.push(event);
            // Aborted as soon as the answer has started, which is the case the
            // port spells out: "including when text had already streamed".
            controller.abort();
        }
    } catch (error) {
        failure = asFailure(error);
    }

    if (failure) {
        return {
            'abort-mid-stream-ends-the-stream': `aborting mid-stream threw out of the stream instead of ending it (${failure})`,
            'abort-mid-stream-reports-zero-usage': `no \`done\` event: the stream threw instead (${failure})`
        };
    }

    const ended = abortedTerminal(events, { allowLeadingEvents: true });
    const done = events.filter(isDone);
    return {
        'abort-mid-stream-ends-the-stream': ended,
        'abort-mid-stream-reports-zero-usage': done[0]
            ? zeroUsage(done[done.length - 1])
            : 'the stream ended without a `done` event'
    };
}

/** `models()`, `capabilities()` and the one rule `resolveModel` exists for. */
async function checkModelResolution(
    subject: ModelProviderConformanceCase
): Promise<
    Pick<
        ModelProviderConformanceReport,
        | 'models-is-not-empty'
        | 'capabilities-defaults-to-the-first-model'
        | 'unknown-model-raises-UnknownModelError'
        | 'unknown-model-costs-no-request'
    >
> {
    const scenario = await subject.text();
    const models = scenario.provider.models();

    const capabilities = await scenario.provider
        .capabilities()
        .then((caps) => caps.model)
        .catch(asFailure);

    const before = subject.requestsIssued();
    let raised: unknown;
    try {
        await drain(
            scenario.provider.stream({
                ...scenario.request,
                model: subject.unknownModel
            })
        );
    } catch (error) {
        raised = error;
    }
    const issued = subject.requestsIssued() - before;

    return {
        'models-is-not-empty':
            models.length > 0
                ? null
                : '`models()` returned nothing, so no request can resolve a model',
        'capabilities-defaults-to-the-first-model':
            capabilities === models[0]
                ? null
                : `\`capabilities()\` reported model "${capabilities}"; the default is the first declared model "${models[0]}"`,
        'unknown-model-raises-UnknownModelError':
            raised instanceof UnknownModelError
                ? null
                : `streaming an unoffered model raised ${describeError(raised)}; the port requires UnknownModelError`,
        'unknown-model-costs-no-request':
            issued === 0
                ? null
                : `streaming an unoffered model still issued ${issued} request(s) to the transport`
    };
}

/** Whether `events` is a well-formed aborted ending. */
function abortedTerminal(
    events: readonly ModelStreamEvent[],
    options: { allowLeadingEvents?: boolean } = {}
): string | null {
    const done = events.filter(isDone);
    if (done.length !== 1) {
        return `the aborted stream carried ${done.length} \`done\` events; exactly one ends a stream`;
    }
    if (!isDone(events[events.length - 1])) {
        return `the aborted stream ended on ${describe(events[events.length - 1])}, not \`done\``;
    }
    if (done[0].stopReason !== 'aborted') {
        return `the aborted stream reported stopReason "${done[0].stopReason}"`;
    }
    if (!options.allowLeadingEvents && events.length !== 1) {
        return `an already-aborted signal produced ${events.length} events; only the \`done\` should be emitted`;
    }
    return null;
}

/** Clause 3: zero on both counts, and nothing smuggled in via a cache count. */
function zeroUsage(done: DoneEvent): string | null {
    const {
        inputTokens,
        outputTokens,
        cachedInputTokens,
        cacheWriteInputTokens
    } = done.usage;
    if (
        inputTokens !== 0 ||
        outputTokens !== 0 ||
        cachedInputTokens ||
        cacheWriteInputTokens
    ) {
        return `an aborted call reported usage ${JSON.stringify(done.usage)}; the port requires zero, because a partial estimate is a guess entering cost accounting as a fact`;
    }
    return null;
}

/** Usage a cost ledger can add up without checking it first. */
function usableUsage(done: DoneEvent): string | null {
    for (const [name, value] of Object.entries(done.usage)) {
        if (value === undefined) continue;
        if (!Number.isFinite(value) || value < 0) {
            return `\`done.usage.${name}\` was ${String(value)}; a token count must be a finite, non-negative number`;
        }
    }
    return null;
}

/** The port's promise that concatenating every delta yields the answer. */
function reassembles(
    events: readonly ModelStreamEvent[],
    answer: string
): string | null {
    const deltas = events.filter((event) => event.type === 'text-delta');
    if (deltas.length < 2) {
        return `the scenario streamed ${deltas.length} \`text-delta\` event(s); a single delta cannot exercise reassembly`;
    }
    const text = deltas
        .map((event) => (event.type === 'text-delta' ? event.text : ''))
        .join('');
    return text === answer
        ? null
        : `the deltas reassembled to ${JSON.stringify(text)} rather than ${JSON.stringify(answer)}`;
}

function isDone(event: ModelStreamEvent | undefined): event is DoneEvent {
    return event?.type === 'done';
}

function describe(event: ModelStreamEvent | undefined): string {
    return event ? `\`${event.type}\`` : 'nothing — the stream was empty';
}

function describeError(error: unknown): string {
    if (error === undefined) {
        return 'nothing (the stream completed)';
    }
    return error instanceof Error
        ? `${error.name}: ${error.message}`
        : String(error);
}

/** Turns a rejection into the sentence a report entry carries. */
function asFailure(error: unknown): string {
    return describeError(error);
}

async function drain(
    events: AsyncIterable<ModelStreamEvent>
): Promise<ModelStreamEvent[]> {
    const collected: ModelStreamEvent[] = [];
    for await (const event of events) {
        collected.push(event);
    }
    return collected;
}
