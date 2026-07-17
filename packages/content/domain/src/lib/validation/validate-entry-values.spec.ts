import { CONTENT_FIELD_TYPE } from '../fields/field-type';
import type { EntryFieldSpecMap } from '../fields/field-spec';
import { validateEntryValues } from './validate-entry-values';

const UUID = '11111111-1111-1111-1111-111111111111';

const fields: EntryFieldSpecMap = {
    title: {
        type: CONTENT_FIELD_TYPE.Text,
        required: true,
        validation: { minLength: 3, maxLength: 10 }
    },
    slug: {
        type: CONTENT_FIELD_TYPE.Text,
        required: false,
        validation: { pattern: '^[a-z-]+$' }
    },
    count: {
        type: CONTENT_FIELD_TYPE.Number,
        required: false,
        validation: { integer: true, min: 1, max: 5 }
    },
    price: {
        type: CONTENT_FIELD_TYPE.Money,
        required: false,
        validation: { min: 0, integer: true }
    },
    active: { type: CONTENT_FIELD_TYPE.Boolean, required: false },
    publishOn: { type: CONTENT_FIELD_TYPE.Date, required: false },
    publishAt: { type: CONTENT_FIELD_TYPE.Datetime, required: false },
    color: {
        type: CONTENT_FIELD_TYPE.Select,
        required: false,
        options: ['red', 'blue']
    },
    author: {
        type: CONTENT_FIELD_TYPE.Relation,
        required: false,
        relation: { many: false }
    },
    tags: {
        type: CONTENT_FIELD_TYPE.Relation,
        required: false,
        relation: { many: true }
    }
};

const fieldsWithIssues = (values: Record<string, unknown>): string[] =>
    validateEntryValues(fields, values, {
        rejectUnknownKeys: true,
        typeName: 'thing'
    }).issues.map((i) => i.field);

describe('validateEntryValues', () => {
    it('passes a fully valid values object', () => {
        const result = validateEntryValues(
            fields,
            {
                title: 'hello',
                slug: 'a-slug',
                count: 3,
                price: 100,
                active: true,
                publishOn: '2026-01-02',
                publishAt: '2026-01-02T03:04:05Z',
                color: 'red',
                author: UUID,
                tags: [UUID]
            },
            { rejectUnknownKeys: true, typeName: 'thing' }
        );
        expect(result).toEqual({ valid: true, issues: [] });
    });

    it('flags a missing required field', () => {
        expect(fieldsWithIssues({})).toContain('title');
    });

    it('treats false and 0 as present, not empty', () => {
        const issues = validateEntryValues(fields, {
            title: 'hello',
            active: false,
            count: 0
        }).issues;
        expect(issues.map((i) => i.field)).not.toContain('active');
        expect(issues.find((i) => i.field === 'count')?.message).toMatch(/≥ 1/);
    });

    it('enforces text length and pattern', () => {
        expect(fieldsWithIssues({ title: 'no' })).toContain('title');
        expect(fieldsWithIssues({ title: 'hello', slug: 'Bad Slug' })).toContain(
            'slug'
        );
    });

    it('enforces integer and number bounds', () => {
        expect(fieldsWithIssues({ title: 'hello', count: 2.5 })).toContain(
            'count'
        );
        expect(fieldsWithIssues({ title: 'hello', count: 99 })).toContain(
            'count'
        );
    });

    it('rejects a date-only string for a datetime field', () => {
        expect(
            fieldsWithIssues({ title: 'hello', publishAt: '2026-01-02' })
        ).toContain('publishAt');
    });

    it('accepts a Date instance for a datetime field', () => {
        expect(
            fieldsWithIssues({
                title: 'hello',
                publishAt: new Date('2026-01-02T00:00:00Z')
            })
        ).not.toContain('publishAt');
    });

    it('rejects a malformed calendar date', () => {
        expect(
            fieldsWithIssues({ title: 'hello', publishOn: '01-02-2026' })
        ).toContain('publishOn');
    });

    it('restricts select to its options', () => {
        expect(fieldsWithIssues({ title: 'hello', color: 'green' })).toContain(
            'color'
        );
    });

    it('requires a uuid for a single relation', () => {
        expect(fieldsWithIssues({ title: 'hello', author: 'nope' })).toContain(
            'author'
        );
    });

    it('skips a many relation in the values bag (link-managed, not validated here)', () => {
        expect(
            fieldsWithIssues({ title: 'hello', tags: ['nope'] })
        ).not.toContain('tags');
    });

    it('skips a required many/inverse relation (link-managed, not in the bag)', () => {
        const linkManaged: EntryFieldSpecMap = {
            title: { type: CONTENT_FIELD_TYPE.Text, required: true },
            tags: {
                type: CONTENT_FIELD_TYPE.Relation,
                required: true,
                relation: { many: true }
            },
            authors: {
                type: CONTENT_FIELD_TYPE.Relation,
                required: true,
                relation: { inverse: { field: 'x' } }
            }
        };
        const issues = validateEntryValues(linkManaged, {
            title: 'hello'
        }).issues.map((i) => i.field);
        expect(issues).not.toContain('tags');
        expect(issues).not.toContain('authors');
    });

    it('rejects unknown fields when asked', () => {
        const issues = validateEntryValues(
            fields,
            { title: 'hello', mystery: 1 },
            { rejectUnknownKeys: true, typeName: 'thing' }
        ).issues;
        expect(issues).toContainEqual({
            field: 'mystery',
            message: 'unknown field on "thing"'
        });
    });

    it('ignores unknown fields when rejectUnknownKeys is off', () => {
        const issues = validateEntryValues(fields, {
            title: 'hello',
            mystery: 1
        }).issues;
        expect(issues.map((i) => i.field)).not.toContain('mystery');
    });
});
