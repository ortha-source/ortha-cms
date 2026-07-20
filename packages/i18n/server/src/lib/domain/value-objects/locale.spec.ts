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
