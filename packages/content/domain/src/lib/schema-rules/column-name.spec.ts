import { mainColumnName, snakeCase } from './column-name';

describe('snakeCase', () => {
    it.each([
        ['readingMinutes', 'reading_minutes'],
        ['seo-meta', 'seo_meta'],
        ['a  b', 'a_b'],
        ['URLSlug', 'urlslug'],
        ['home_page', 'home_page']
    ])('%s → %s', (input, output) => {
        expect(snakeCase(input)).toBe(output);
    });
});

describe('mainColumnName', () => {
    const relation = (many: boolean, inverse?: { field: string }) => ({
        type: 'relation',
        required: false,
        relation: {
            to: 'x',
            many,
            unique: false,
            onDelete: 'set null' as const,
            syncAcrossLocales: true,
            inverse
        }
    });

    it('names a scalar after the field', () => {
        expect(
            mainColumnName('startsAt', { type: 'datetime', required: false })
        ).toBe('starts_at');
    });

    it('names a single relation <field>_id', () => {
        expect(mainColumnName('author', relation(false))).toBe('author_id');
    });

    it('gives a many-relation and an inverse no column', () => {
        expect(mainColumnName('tags', relation(true))).toBeNull();
        expect(
            mainColumnName('posts', relation(false, { field: 'author' }))
        ).toBeNull();
    });
});
