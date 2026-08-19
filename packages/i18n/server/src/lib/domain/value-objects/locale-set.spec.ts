import { LocaleSet } from './locale-set';
import { Locale } from './locale';
import { InvalidLocaleSetError } from '../errors';

const en = { slug: 'en', name: 'English', isDefault: true };
const de = { slug: 'de', name: 'Deutsch' };

describe('LocaleSet value object', () => {
    it('builds from defs, preserving config order', () => {
        const set = LocaleSet.fromDefs([en, de]);
        expect(set.all().map((locale) => locale.slug)).toEqual(['en', 'de']);
    });

    it('exposes the default, lookups, and membership', () => {
        const set = LocaleSet.fromDefs([en, de]);
        expect(set.default().slug).toBe('en');
        expect(set.get('de')?.name).toBe('Deutsch');
        expect(set.get('fr')).toBeUndefined();
        expect(set.has('en')).toBe(true);
        expect(set.has('fr')).toBe(false);
    });

    it('rejects an empty set', () => {
        expect(() => LocaleSet.fromDefs([])).toThrow(/at least one locale/);
    });

    it('rejects a duplicate slug', () => {
        expect(() =>
            LocaleSet.fromDefs([en, { slug: 'en', name: 'English (US)' }])
        ).toThrow(/Duplicate locale slug "en"/);
    });

    it.each([
        ['zero', [de], 0],
        ['two', [en, { slug: 'de', name: 'Deutsch', isDefault: true }], 2]
    ])('rejects %s defaults', (_label, defs, count) => {
        expect(() => LocaleSet.fromDefs(defs)).toThrow(
            new RegExp(
                `Exactly one locale must set isDefault \\(got ${count}\\)`
            )
        );
    });

    describe('remove', () => {
        it('drops a non-default member', () => {
            const set = LocaleSet.fromDefs([en, de]).remove('de');
            expect(set.all().map((locale) => locale.slug)).toEqual(['en']);
        });

        it('refuses to remove the default', () => {
            expect(() => LocaleSet.fromDefs([en, de]).remove('en')).toThrow(
                /Cannot remove the default locale/
            );
        });

        it('refuses to remove a non-member', () => {
            expect(() => LocaleSet.fromDefs([en, de]).remove('fr')).toThrow(
                InvalidLocaleSetError
            );
        });
    });

    it('accepts pre-built Locale instances via create', () => {
        const set = LocaleSet.create([Locale.create(en), Locale.create(de)]);
        expect(set.default().slug).toBe('en');
    });
});
