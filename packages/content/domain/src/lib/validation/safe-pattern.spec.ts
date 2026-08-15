import {
    compilePattern,
    isPotentiallyCatastrophic,
    MAX_PATTERN_SOURCE_LENGTH
} from './safe-pattern';

describe('isPotentiallyCatastrophic', () => {
    it.each([
        '^(a+)+$',
        '(a*)*',
        '(a+|b+)+',
        '(a*b*)*',
        '(\\d+\\w*)+',
        '^(\\s+)*$',
        '((a+)+)+'
    ])('flags the ambiguous nested quantifier in %s', (pattern) => {
        expect(isPotentiallyCatastrophic(pattern)).toBe(true);
    });

    it.each([
        '^[a-z-]+$',
        '^([a-z0-9]+-)*[a-z0-9]+$',
        '^(a+b)+$',
        '^\\d{4}-\\d{2}-\\d{2}$',
        '^(?:foo|bar)+$',
        '^(?:https?)://\\S+$',
        '[+*]{1,3}',
        'abc',
        ''
    ])('leaves the benign pattern %s alone', (pattern) => {
        expect(isPotentiallyCatastrophic(pattern)).toBe(false);
    });

    it('rejects a pattern source that is absurdly long', () => {
        expect(
            isPotentiallyCatastrophic('a'.repeat(MAX_PATTERN_SOURCE_LENGTH + 1))
        ).toBe(true);
    });
});

describe('compilePattern', () => {
    it('compiles and caches a usable pattern', () => {
        const first = compilePattern('^[a-z]+$');
        const second = compilePattern('^[a-z]+$');
        expect(first.regex).toBeInstanceOf(RegExp);
        expect(second.regex).toBe(first.regex);
    });

    it('reports an uncompilable source instead of throwing', () => {
        expect(() => compilePattern('(')).not.toThrow();
        expect(compilePattern('(')).toEqual({ rejected: 'invalid' });
    });

    it('refuses a catastrophic source without running it', () => {
        expect(compilePattern('^(a+)+$')).toEqual({ rejected: 'unsafe' });
    });
});
