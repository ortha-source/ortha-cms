import {
    SUPPORTED_BASELINE,
    baselineShortfalls,
    meetsSupportedBaseline,
    type ModelCapabilities
} from './model-capabilities';

/**
 * The supported baseline is the one place the copilot says out loud what
 * "properly supported" means (ADR-0004 §4). Degraded mode is real code and a
 * real UI state, so the comparison that drives it is tested rather than
 * assumed — and each dimension is reported separately, because the UI has to
 * name *which* capability is missing.
 */
describe('supported baseline', () => {
    const frontier: ModelCapabilities = {
        model: 'claude-opus-5',
        toolCalling: true,
        streaming: true,
        vision: true,
        contextWindow: 1_000_000,
        maxOutputTokens: 64_000
    };

    it('reports no shortfalls for a frontier model', () => {
        expect(baselineShortfalls(frontier)).toEqual([]);
        expect(meetsSupportedBaseline(frontier)).toBe(true);
    });

    it('flags a model without native tool calling', () => {
        expect(baselineShortfalls({ ...frontier, toolCalling: false })).toEqual(
            ['tool-calling']
        );
    });

    it('flags a model that cannot stream', () => {
        expect(baselineShortfalls({ ...frontier, streaming: false })).toEqual([
            'streaming'
        ]);
    });

    it('flags a context window under the baseline', () => {
        expect(
            baselineShortfalls({
                ...frontier,
                contextWindow: SUPPORTED_BASELINE.contextWindow - 1
            })
        ).toEqual(['context-window']);
    });

    it('accepts a context window exactly at the baseline', () => {
        expect(
            meetsSupportedBaseline({
                ...frontier,
                contextWindow: SUPPORTED_BASELINE.contextWindow
            })
        ).toBe(true);
    });

    it('reports every shortfall at once, not just the first', () => {
        const laptopModel: ModelCapabilities = {
            model: 'tinyllama',
            toolCalling: false,
            streaming: false,
            vision: false,
            contextWindow: 2_048,
            maxOutputTokens: 512
        };
        expect(baselineShortfalls(laptopModel)).toEqual([
            'tool-calling',
            'streaming',
            'context-window'
        ]);
        expect(meetsSupportedBaseline(laptopModel)).toBe(false);
    });
});
