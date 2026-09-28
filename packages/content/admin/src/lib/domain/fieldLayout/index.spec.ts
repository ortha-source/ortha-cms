import type { ContentField } from '../types/contentType';
import { MAX_ROW_FIELDS, fieldWidth, layoutFields } from '.';

/** A field of `type` named `name`, with the given admin hints. */
function field(
    name: string,
    type = 'text',
    admin: Record<string, unknown> = {}
): ContentField {
    return { name, type, required: false, validation: {}, admin };
}

/** The layout reduced to names: a string per single, an array per row. */
function shape(fields: ContentField[]) {
    return layoutFields(fields).map((block) =>
        block.kind === 'single'
            ? block.field.name
            : block.fields.map((f) => f.name)
    );
}

describe('fieldWidth', () => {
    it.each([
        'text',
        'number',
        'money',
        'date',
        'datetime',
        'select',
        'richtext',
        'json',
        'multiselect',
        'relation'
    ])('draws a %s field full width unless told otherwise', (type) => {
        expect(fieldWidth(field('f', type))).toBe('full');
    });

    it('never infers a width from a widget', () => {
        // The old type-based rule put an email in half a column and a slug,
        // often as short, across the whole form. The schema decides now.
        for (const widget of ['email', 'color', 'slug', 'textarea']) {
            expect(fieldWidth(field('w', 'text', { widget }))).toBe('full');
        }
    });

    it('gives half a column to any field whose schema asks', () => {
        expect(fieldWidth(field('sku', 'text', { width: 'half' }))).toBe(
            'half'
        );
        expect(fieldWidth(field('price', 'money', { width: 'half' }))).toBe(
            'half'
        );
    });

    it('shrinks a boolean to its segments, unless the schema says otherwise', () => {
        expect(fieldWidth(field('b', 'boolean'))).toBe('fit');
        expect(fieldWidth(field('b', 'boolean', { width: 'half' }))).toBe(
            'half'
        );
        expect(fieldWidth(field('b', 'boolean', { width: 'full' }))).toBe(
            'full'
        );
    });

    it('ignores a width it does not know', () => {
        expect(fieldWidth(field('t', 'text', { width: 'third' }))).toBe('full');
        expect(fieldWidth(field('t', 'text', { width: 50 }))).toBe('full');
    });
});

describe('layoutFields', () => {
    it('keeps one field per line when no row is declared', () => {
        expect(
            shape([field('a', 'number'), field('b', 'number'), field('c')])
        ).toEqual(['a', 'b', 'c']);
    });

    it('never pairs short fields on its own', () => {
        // Adjacent short scalars stay apart: a row is the schema's claim that
        // two fields belong together, and the editor cannot make that claim.
        expect(shape([field('a', 'date'), field('b', 'datetime')])).toEqual([
            'a',
            'b'
        ]);
    });

    it('puts fields sharing a row key on one line', () => {
        expect(
            shape([
                field('title'),
                field('start', 'date', { row: 'when' }),
                field('end', 'date', { row: 'when' }),
                field('body', 'richtext')
            ])
        ).toEqual(['title', ['start', 'end'], 'body']);
    });

    it('places a row where its first member is, pulling later ones in', () => {
        expect(
            shape([
                field('a', 'number', { row: 'r' }),
                field('b'),
                field('c', 'number', { row: 'r' })
            ])
        ).toEqual([['a', 'c'], 'b']);
    });

    it('draws a row with one member as a plain field', () => {
        expect(shape([field('a', 'number', { row: 'lonely' })])).toEqual(['a']);
    });

    it('ignores a blank or non-string row key', () => {
        expect(
            shape([
                field('a', 'number', { row: ' ' }),
                field('b', 'number', { row: ' ' }),
                field('c', 'number', { row: 1 }),
                field('d', 'number', { row: 1 })
            ])
        ).toEqual(['a', 'b', 'c', 'd']);
    });

    it(`caps a row at ${MAX_ROW_FIELDS} fields and starts a new line`, () => {
        const fields = ['a', 'b', 'c'].map((name) =>
            field(name, 'number', { row: 'r' })
        );
        expect(shape(fields)).toEqual([['a', 'b'], 'c']);
    });
});
