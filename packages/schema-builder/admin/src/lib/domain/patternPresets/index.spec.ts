import { PATTERN_PRESETS, testPattern } from './index';

describe('pattern presets', () => {
    const preset = (id: string) =>
        PATTERN_PRESETS.find((p) => p.id === id)?.pattern ?? '';

    it('offer patterns that do what they are named for', () => {
        expect(testPattern(preset('slug'), 'hello-world')).toBe(true);
        expect(testPattern(preset('slug'), 'Hello World')).toBe(false);
        expect(testPattern(preset('email'), 'a@b.co')).toBe(true);
        expect(testPattern(preset('url'), 'https://example.com/x')).toBe(true);
    });

    it('report a pattern that does not compile as null rather than throwing', () => {
        expect(testPattern('([a-z', 'x')).toBeNull();
    });
});
