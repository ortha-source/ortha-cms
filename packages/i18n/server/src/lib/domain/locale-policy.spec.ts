import { LocalePolicy } from './locale-policy';
import { LocaleSet } from './value-objects/locale-set';
import { UnknownLocaleError } from './errors';

const set = LocaleSet.fromDefs([
    { slug: 'en', name: 'English', isDefault: true },
    { slug: 'de', name: 'Deutsch' }
]);
const policy = new LocalePolicy(set);

describe('LocalePolicy', () => {
    describe('resolve', () => {
        it('returns the default when the slug is absent', () => {
            expect(policy.resolve(undefined).slug).toBe('en');
        });

        it('returns the named locale', () => {
            expect(policy.resolve('de').slug).toBe('de');
        });

        it('throws UnknownLocaleError for an unconfigured slug', () => {
            expect(() => policy.resolve('fr')).toThrow(UnknownLocaleError);
        });
    });

    describe('shouldWidenToDefault', () => {
        it('widens when fallback is requested for a non-default locale', () => {
            expect(
                policy.shouldWidenToDefault(policy.resolve('de'), true)
            ).toBe(true);
        });

        it('does not widen without a fallback request', () => {
            expect(
                policy.shouldWidenToDefault(policy.resolve('de'), false)
            ).toBe(false);
        });

        it('does not widen when the requested locale is the default', () => {
            expect(
                policy.shouldWidenToDefault(policy.resolve('en'), true)
            ).toBe(false);
        });
    });

    describe('fallbackChain', () => {
        it('is [requested, default] when widening [i18n:I-07]', () => {
            expect(
                policy
                    .fallbackChain(policy.resolve('de'), true)
                    .map((l) => l.slug)
            ).toEqual(['de', 'en']);
        });

        it('is [requested] in strict mode', () => {
            expect(
                policy
                    .fallbackChain(policy.resolve('de'), false)
                    .map((l) => l.slug)
            ).toEqual(['de']);
        });

        it('is [default] when the requested locale is the default', () => {
            expect(
                policy
                    .fallbackChain(policy.resolve('en'), true)
                    .map((l) => l.slug)
            ).toEqual(['en']);
        });
    });

    describe('requiredLocalesForPublish', () => {
        it('always requires the default locale', () => {
            expect(
                policy.requiredLocalesForPublish().map((l) => l.slug)
            ).toEqual(['en']);
        });
    });
});
