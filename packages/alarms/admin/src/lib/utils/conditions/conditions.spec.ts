import type {
    FilterField,
    FilterGroup,
    FilterRule
} from '@orthacms/query-builder-admin';
import {
    changedConditionIds,
    conditionFieldText,
    conditionSignature,
    conditionValueText,
    flattenConditions,
    humanizeFieldId,
    removeCondition
} from './index';

/**
 * The pure half of the condition chips: what a chip says, what removing one
 * leaves, and which conditions differ from the stored alarm — the last being
 * what the editor tints when the preview says the condition is inverted.
 */

const rule = (
    id: string,
    fieldId: string,
    op: FilterRule['op'],
    value: FilterRule['value'] = null
): FilterRule => ({ id, fieldId, op, value });

const group = (id: string, children: FilterGroup['children']): FilterGroup => ({
    id,
    combinator: 'and',
    children
});

const label = (descriptor: FilterField['label']) =>
    String(descriptor.defaultMessage ?? descriptor.id);

const FIELDS: FilterField[] = [
    {
        id: 'seo',
        label: { id: 'seo', defaultMessage: 'SEO description' },
        type: 'string'
    },
    {
        id: 'status',
        label: { id: 'status', defaultMessage: 'Status' },
        type: 'enum',
        enumValues: [
            {
                value: 'published',
                label: { id: 'p', defaultMessage: 'Published' }
            },
            { value: 'draft', label: { id: 'd', defaultMessage: 'Draft' } }
        ]
    },
    {
        id: 'author.name',
        label: { id: 'name', defaultMessage: 'Name' },
        type: 'string',
        group: [{ id: 'author', defaultMessage: 'Author' }]
    }
];

describe('flattenConditions', () => {
    it('lists every leaf, nested groups included, and nothing for null', () => {
        const tree = group('g', [
            rule('a', 'seo', 'is_empty'),
            group('h', [rule('b', 'status', 'equals', 'published')])
        ]);
        expect(flattenConditions(tree).map((r) => r.id)).toEqual(['a', 'b']);
        expect(flattenConditions(null)).toEqual([]);
    });
});

describe('removeCondition', () => {
    it('drops one condition and prunes a group it emptied', () => {
        const tree = group('g', [
            rule('a', 'seo', 'is_empty'),
            group('h', [rule('b', 'status', 'equals', 'published')])
        ]);
        const next = removeCondition(tree, 'b');
        expect(next?.children).toEqual([rule('a', 'seo', 'is_empty')]);
    });

    it('answers null once nothing is left — an empty tree is no tree [alarms:I-27]', () => {
        const tree = group('g', [rule('a', 'seo', 'is_empty')]);
        expect(removeCondition(tree, 'a')).toBeNull();
    });
});

describe('changedConditionIds', () => {
    it('ignores the client ids and compares what each condition says', () => {
        const saved = group('g1', [
            rule('s1', 'seo', 'is_empty'),
            rule('s2', 'status', 'equals', 'published')
        ]);
        // The same stored filter, re-parsed: fresh ids, same conditions.
        const current = group('g2', [
            rule('c1', 'seo', 'is_empty'),
            rule('c2', 'seo', 'is_not_empty')
        ]);
        expect([...changedConditionIds(current, saved)]).toEqual(['c2']);
    });

    it('counts duplicates, so a second copy of a stored condition is a change', () => {
        const saved = group('g1', [rule('s1', 'seo', 'is_empty')]);
        const current = group('g2', [
            rule('c1', 'seo', 'is_empty'),
            rule('c2', 'seo', 'is_empty')
        ]);
        expect([...changedConditionIds(current, saved)]).toEqual(['c2']);
    });

    it('treats every condition of a new alarm as new', () => {
        const current = group('g', [rule('c1', 'seo', 'is_empty')]);
        expect([...changedConditionIds(current, null)]).toEqual(['c1']);
    });

    it('keys a condition on field, operator and value', () => {
        expect(conditionSignature(rule('x', 'a', 'equals', 'v'))).toBe(
            conditionSignature(rule('y', 'a', 'equals', 'v'))
        );
        expect(conditionSignature(rule('x', 'a', 'equals', 'v'))).not.toBe(
            conditionSignature(rule('x', 'a', 'equals', 'w'))
        );
    });
});

describe('chip text', () => {
    it('names a grouped field by its whole path', () => {
        expect(conditionFieldText(FIELDS, 'author.name', label)).toBe(
            'Author · Name'
        );
    });

    it('makes a field the surface no longer offers readable, not blank', () => {
        expect(conditionFieldText(FIELDS, 'category', label)).toBe('Category');
        expect(humanizeFieldId('seoDescription')).toBe('Seo description');
        expect(humanizeFieldId('author.first_name')).toBe(
            'Author · First name'
        );
    });

    it('renders an enum value through its label, and no value for is-empty', () => {
        const status = FIELDS[1];
        expect(
            conditionValueText(
                status,
                rule('a', 'status', 'equals', 'published'),
                label
            )
        ).toBe('Published');
        expect(
            conditionValueText(
                status,
                rule('a', 'status', 'is_one_of', ['draft', 'archived']),
                label
            )
        ).toBe('Draft, archived');
        expect(
            conditionValueText(FIELDS[0], rule('a', 'seo', 'is_empty'), label)
        ).toBeNull();
    });

    it('spells a rolling window as the window [alarms:I-26]', () => {
        expect(
            conditionValueText(
                undefined,
                rule('a', 'updatedAt', 'within_last', {
                    n: 30,
                    unit: 'days'
                }),
                label
            )
        ).toBe('30 days');
    });
});
