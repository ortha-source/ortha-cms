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
    },
    cover: { type: CONTENT_FIELD_TYPE.Media, required: false },
    photos: {
        type: CONTENT_FIELD_TYPE.Media,
        required: false,
        multiple: true
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
                tags: [UUID],
                cover: UUID,
                photos: [UUID]
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
        expect(
            fieldsWithIssues({ title: 'hello', slug: 'Bad Slug' })
        ).toContain('slug');
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

describe('validateEntryValues — media fields', () => {
    // Validate the shared `fields` map with a valid title plus the media values
    // under test, keeping only the media-field issues.
    const only = (values: Record<string, unknown>) =>
        validateEntryValues(fields, {
            title: 'hello',
            ...values
        }).issues.filter((i) => i.field === 'cover' || i.field === 'photos');

    it('accepts a uuid for a single media field', () => {
        expect(only({ cover: UUID })).toEqual([]);
    });

    it('rejects a non-uuid single media value', () => {
        expect(only({ cover: 'not-a-uuid' })).toContainEqual({
            field: 'cover',
            message: 'must be a media asset id'
        });
    });

    it('accepts a uuid[] for a multiple media field', () => {
        expect(only({ photos: [UUID, UUID] })).toEqual([]);
    });

    it('rejects a bare string for a multiple media field', () => {
        expect(only({ photos: UUID })).toContainEqual({
            field: 'photos',
            message: 'must be an array of media asset ids'
        });
    });

    it('rejects a multiple media array containing a non-uuid', () => {
        expect(only({ photos: [UUID, 'nope'] })).toContainEqual({
            field: 'photos',
            message: 'must be an array of media asset ids'
        });
    });

    it('treats empty single/multiple as absent (not required)', () => {
        expect(only({ cover: '', photos: [] })).toEqual([]);
    });

    it('trips required on an empty required media field', () => {
        const requiredFields = {
            hero: {
                type: CONTENT_FIELD_TYPE.Media,
                required: true
            },
            shots: {
                type: CONTENT_FIELD_TYPE.Media,
                required: true,
                multiple: true
            }
        };
        const issues = validateEntryValues(requiredFields, {
            hero: null,
            shots: []
        }).issues;
        expect(issues).toContainEqual({
            field: 'hero',
            message: 'is required'
        });
        expect(issues).toContainEqual({
            field: 'shots',
            message: 'is required'
        });
    });
});

describe('validateEntryValues — wysiwyg fields', () => {
    const wysiwygFields: EntryFieldSpecMap = {
        body: {
            type: CONTENT_FIELD_TYPE.Wysiwyg,
            required: true,
            validation: { minLength: 5, maxLength: 20 }
        }
    };

    const issuesFor = (value: unknown): string[] =>
        validateEntryValues(wysiwygFields, { body: value }).issues.map(
            (issue) => issue.message
        );

    it('accepts HTML whose text is within the limits', () => {
        expect(issuesFor('<p>Hello there</p>')).toEqual([]);
    });

    it('measures length on the text, not on the markup', () => {
        // 10 characters of text wrapped in markup far longer than `maxLength`.
        expect(
            issuesFor('<p><strong><em>Hello</em> <u>you</u>!</strong></p>')
        ).toEqual([]);
    });

    it('rejects text below minLength', () => {
        expect(issuesFor('<p><strong>hi</strong></p>')).toEqual([
            'must be at least 5 characters'
        ]);
    });

    it('rejects text above maxLength', () => {
        expect(issuesFor(`<p>${'a'.repeat(21)}</p>`)).toEqual([
            'must be at most 20 characters'
        ]);
    });

    it('treats empty markup as an empty required value', () => {
        expect(issuesFor('')).toEqual(['is required']);
    });

    it('rejects a non-string value', () => {
        expect(issuesFor({ blocks: [] })).toEqual(['must be a string']);
    });
});
