import { billableTokens } from './billable-tokens';

describe('billableTokens', () => {
    it('adds uncached input and output', () => {
        expect(billableTokens({ inputTokens: 120, outputTokens: 30 })).toBe(
            150
        );
    });

    // A write is billed at a premium; leaving it out would make turning
    // caching on look like a saving.
    it('counts cache writes', () => {
        expect(
            billableTokens({
                inputTokens: 100,
                outputTokens: 10,
                cacheWriteInputTokens: 900
            })
        ).toBe(1010);
    });

    // A read is the point of caching, and charging for it would spend the
    // budget re-reading a prompt the provider already has.
    it('leaves cache reads out', () => {
        expect(
            billableTokens({
                inputTokens: 100,
                outputTokens: 10,
                cachedInputTokens: 5000
            })
        ).toBe(110);
    });
});
