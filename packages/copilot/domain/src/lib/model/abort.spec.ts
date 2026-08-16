import { abortedEvent, isAbortError } from './abort';

describe('isAbortError', () => {
    // The signal is checked first on purpose: a provider that observes its own
    // abort may surface it as any error type, so an aborted signal is a more
    // reliable witness than an error's `name`.
    it('trusts an aborted signal whatever the error looks like', () => {
        expect(
            isAbortError(new TypeError('socket closed'), AbortSignal.abort())
        ).toBe(true);
        expect(isAbortError('not even an error', AbortSignal.abort())).toBe(
            true
        );
    });

    it('falls back to the error name when no signal is given', () => {
        const error = Object.assign(new Error('aborted'), {
            name: 'AbortError'
        });

        expect(isAbortError(error)).toBe(true);
    });

    it('does not mistake a real failure for a cancellation', () => {
        expect(isAbortError(new Error('502 from upstream'))).toBe(false);
        expect(
            isAbortError(
                new Error('502 from upstream'),
                new AbortController().signal
            )
        ).toBe(false);
    });
});

describe('abortedEvent', () => {
    // Clause 3 of `ModelProvider.stream`: an aborted call reports zero usage,
    // including when text had already streamed. A partial estimate is a guess
    // entering cost accounting as a fact, so the number is pinned here rather
    // than restated in each of the three adapters.
    it('is a terminal `done` reporting zero usage', () => {
        expect(abortedEvent()).toEqual({
            type: 'done',
            stopReason: 'aborted',
            usage: { inputTokens: 0, outputTokens: 0 }
        });
    });

    it('returns a fresh object each call, so a caller cannot poison it', () => {
        const first = abortedEvent();
        first.usage.outputTokens = 999;

        expect(abortedEvent().usage.outputTokens).toBe(0);
    });
});
