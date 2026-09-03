import { Locale } from './locale';
import { InvalidLocaleError } from '../errors';

describe('Locale value object', () => {
    it('accepts a well-formed slug and name', () => {
        const locale = Locale.create({ slug: 'pt-br', name: 'Português' });
        expect(locale.slug).toBe('pt-br');
        expect(locale.name).toBe('Português');
        expect(locale.isDefault).toBe(false);
    });

    it('defaults isDefault to false and carries it when set', () => {
        expect(Locale.create({ slug: 'en', name: 'English' }).isDefault).toBe(
            false
        );
        expect(
            Locale.create({ slug: 'en', name: 'English', isDefault: true })
                .isDefault
        ).toBe(true);
    });

    it.each([
        ['uppercase', 'EN'],
        ['underscore', 'en_us'],
        ['leading digit', '1en'],
        ['too long a primary tag', 'abcd'],
        ['empty', '']
        // covers: i18n:I-03
    ])('rejects a %s slug', (_label, slug) => {
        expect(() => Locale.create({ slug, name: 'X' })).toThrow(
            InvalidLocaleError
        );
    });

    it('rejects a blank name', () => {
        expect(() => Locale.create({ slug: 'en', name: '   ' })).toThrow(
            /empty name/
        );
    });

    it('compares by slug', () => {
        const a = Locale.create({ slug: 'en', name: 'English' });
        const b = Locale.create({ slug: 'en', name: 'English (US)' });
        const c = Locale.create({ slug: 'de', name: 'Deutsch' });
        expect(a.equals(b)).toBe(true);
        expect(a.equals(c)).toBe(false);
    });
});

describe('Locale — text direction (A11Y: WCAG 1.3.2)', () => {
    it.each([
        ['Arabic', 'ar'],
        ['Hebrew', 'he'],
        ['Persian', 'fa'],
        ['Urdu', 'ur'],
        ['Central Kurdish', 'ckb'],
        ['a region subtag on an RTL language', 'ar-eg']
    ])('infers rtl for %s', (_label, slug) => {
        expect(Locale.create({ slug, name: 'X' }).dir).toBe('rtl');
    });

    it.each([
        ['English', 'en'],
        ['German', 'de'],
        ['Brazilian Portuguese', 'pt-br'],
        ['Simplified Chinese', 'zh-hans']
    ])('infers ltr for %s', (_label, slug) => {
        expect(Locale.create({ slug, name: 'X' }).dir).toBe('ltr');
    });

    it('lets an explicit script subtag override the language', () => {
        // A language written RTL elsewhere, romanised here.
        expect(Locale.create({ slug: 'ku-latn', name: 'X' }).dir).toBe('ltr');
        // …and the converse: a Latin-script language written in Arabic script.
        expect(Locale.create({ slug: 'az-arab', name: 'X' }).dir).toBe('rtl');
    });

    it('lets the config declare a direction outright', () => {
        expect(Locale.create({ slug: 'en', name: 'X', dir: 'rtl' }).dir).toBe(
            'rtl'
        );
        expect(Locale.create({ slug: 'ar', name: 'X', dir: 'ltr' }).dir).toBe(
            'ltr'
        );
    });

    it('rejects a dir that is neither ltr nor rtl', () => {
        expect(() =>
            Locale.create({
                slug: 'en',
                name: 'X',
                dir: 'sideways' as never
            })
        ).toThrow(InvalidLocaleError);
    });
});
