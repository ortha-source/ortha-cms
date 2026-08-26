import { FIELD_TYPE } from '../types/filter-field.type';
import type { FilterField } from '../types/filter-field.type';
import { buildFieldTree } from './fieldTree';

const AUTHOR = { id: 'qb.test.author', defaultMessage: 'Author' };
const SEGMENTATION = {
    id: 'qb.test.segmentation',
    defaultMessage: 'Segmentation'
};

/** A field of the given id, optionally under a group. */
function field(id: string, group?: { id: string; defaultMessage: string }[]) {
    return {
        id,
        label: { id: `qb.test.${id}`, defaultMessage: id },
        type: FIELD_TYPE.String,
        ...(group ? { group } : {})
    } as FilterField;
}

describe('buildFieldTree', () => {
    it('keeps an ungrouped flat field as a root scalar', () => {
        const tree = buildFieldTree([field('title')]);

        expect(tree.fields.map((f) => f.id)).toEqual(['title']);
        expect(tree.categories).toEqual([]);
        expect(tree.relations).toEqual([]);
    });

    it('reads a dotted id as a relation, labelled by its group', () => {
        const tree = buildFieldTree([field('author.name', [AUTHOR])]);

        expect(tree.fields).toEqual([]);
        expect(tree.relations).toHaveLength(1);
        expect(tree.relations[0].key).toBe('author');
        expect(tree.relations[0].label).toBe(AUTHOR);
        expect(tree.relations[0].fields.map((f) => f.id)).toEqual([
            'author.name'
        ]);
    });

    it('reads a group on a FLAT field as a plain category', () => {
        // The whole distinction: `group` says "under what heading", and the
        // `id` says whether that heading is traversable.
        const tree = buildFieldTree([
            field('audienceAllowed', [SEGMENTATION]),
            field('accessRestricted', [SEGMENTATION])
        ]);

        expect(tree.fields).toEqual([]);
        expect(tree.relations).toEqual([]);
        expect(tree.categories).toHaveLength(1);
        expect(tree.categories[0].label).toBe(SEGMENTATION);
        expect(tree.categories[0].fields.map((f) => f.id)).toEqual([
            'audienceAllowed',
            'accessRestricted'
        ]);
    });

    it('keeps categories in first-appearance order', () => {
        const other = { id: 'qb.test.other', defaultMessage: 'Other' };
        const tree = buildFieldTree([
            field('b', [other]),
            field('a', [SEGMENTATION]),
            field('c', [other])
        ]);

        expect(tree.categories.map((c) => c.key)).toEqual([
            other.id,
            SEGMENTATION.id
        ]);
    });

    it('sorts the three kinds apart in one pass', () => {
        const tree = buildFieldTree([
            field('title'),
            field('audienceAllowed', [SEGMENTATION]),
            field('author.name', [AUTHOR])
        ]);

        expect(tree.fields.map((f) => f.id)).toEqual(['title']);
        expect(tree.categories.map((c) => c.fields.length)).toEqual([1]);
        expect(tree.relations.map((r) => r.key)).toEqual(['author']);
    });
});
