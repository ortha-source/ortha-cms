import type { ContentField, ContentFieldGroup } from '../types/contentType';
import { outlineGeneralTab } from '.';

/** A field of `type` named `name`, with the given admin hints and flags. */
function field(
    name: string,
    type = 'text',
    admin: Record<string, unknown> = {},
    localized = false
): ContentField {
    return {
        name,
        type,
        required: false,
        validation: {},
        admin,
        ...(localized ? { localized } : {})
    };
}

function group(key: string): ContentFieldGroup {
    return { key, label: `Group ${key}`, collapsed: false };
}

/** The outline reduced to names: `#key` for a section stop. */
function shape(items: ReturnType<typeof outlineGeneralTab>): string[] {
    return items.map((item) =>
        item.kind === 'section' ? `#${item.key}` : item.field.name
    );
}

describe('outlineGeneralTab', () => {
    it('is empty for a tab with no fields', () => {
        expect(outlineGeneralTab([], undefined)).toEqual([]);
    });

    /**
     * The form orders by control shape — inputs, then large fields — not by
     * declaration. A bar listed in declaration order would sit above a field
     * drawn below its neighbour.
     */
    it('lists fields in the order the form draws them', () => {
        const items = outlineGeneralTab(
            [field('body', 'richtext'), field('title'), field('slug')],
            undefined
        );

        expect(shape(items)).toEqual(['title', 'slug', 'body']);
    });

    it('lists each declared section before its own fields, after the loose ones', () => {
        const items = outlineGeneralTab(
            [
                field('meta', 'text', { group: 'seo' }),
                field('title'),
                field('starts', 'date', { group: 'when' })
            ],
            [group('when'), group('seo')]
        );

        expect(shape(items)).toEqual([
            'title',
            '#when',
            'starts',
            '#seo',
            'meta'
        ]);
        expect(items[1]).toEqual({
            kind: 'section',
            key: 'when',
            label: 'Group when'
        });
        // A field in a section knows which one, so a jump can unfold it.
        expect(items[2]).toMatchObject({ section: 'when' });
        expect(items[0]).not.toHaveProperty('section');
    });

    /**
     * On a localized type the form draws the translated run above the shared
     * one, whatever order the schema declared them in.
     */
    it('lists the translated run before the shared one', () => {
        const items = outlineGeneralTab(
            [
                field('sku'),
                field('title', 'text', {}, true),
                field('price', 'number')
            ],
            undefined
        );

        expect(shape(items)).toEqual(['title', 'sku', 'price']);
    });
});
