import { CONTENT_FIELD_TYPE } from '../fields/field-type';
import type { EntryFieldSpec, EntryFieldSpecMap } from '../fields/field-spec';
import {
    validateEntryValues,
    validateFieldValue
} from './validate-entry-values';

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

    // BUG-content-domain-01 — `key in fields` walked the prototype chain, so a
    // values key naming any `Object.prototype` member was accepted as "known"
    // while `Object.entries(fields)` never validated it: an unchecked key
    // straight into the stored values bag.
    it.each([
        'toString',
        'constructor',
        'valueOf',
        'hasOwnProperty',
        'isPrototypeOf',
        'propertyIsEnumerable',
        '__proto__'
    ])('reports the Object.prototype member %s as an unknown key', (key) => {
        const issues = validateEntryValues(
            fields,
            { title: 'hello', [key]: 1 },
            { rejectUnknownKeys: true, typeName: 'thing' }
        ).issues;
        expect(issues).toContainEqual({
            field: key,
            message: `unknown field on "thing"`
        });
    });

    // EC-21 — the mirror image: a field genuinely named `toString` is an own
    // key of the schema, so it is known *and* validated.
    it.each([
        'toString',
        'constructor',
        'valueOf',
        'hasOwnProperty',
        '__proto__'
    ])('validates a field genuinely named %s', (name) => {
        const shadowing: EntryFieldSpecMap = {
            [name]: { type: CONTENT_FIELD_TYPE.Text, required: true }
        };
        expect(
            validateEntryValues(
                shadowing,
                { [name]: 'hello' },
                { rejectUnknownKeys: true, typeName: 'thing' }
            ).issues
        ).toEqual([]);
        // A required field whose name shadows an `Object.prototype` member must
        // still be *missing* when the bag does not carry it — reading it off
        // the prototype made the inherited member look like a supplied value.
        expect(validateEntryValues(shadowing, {}).issues).toEqual([
            { field: name, message: 'is required' }
        ]);
    });

    // EC-22 — a null-prototype values bag behaves identically; the chain that
    // mattered was the schema's, not the values'.
    it('handles a values bag created with Object.create(null)', () => {
        const values = Object.create(null) as Record<string, unknown>;
        values['title'] = 'hello';
        values['mystery'] = 1;
        expect(
            validateEntryValues(fields, values, {
                rejectUnknownKeys: true,
                typeName: 'thing'
            }).issues
        ).toEqual([{ field: 'mystery', message: 'unknown field on "thing"' }]);
    });
});

describe('validateFieldValue — text length and pattern', () => {
    const lengths: EntryFieldSpec = {
        type: CONTENT_FIELD_TYPE.Text,
        required: false,
        validation: { minLength: 3, maxLength: 10 }
    };

    // EC-06 — both comparisons are strict, so the bounds are inclusive.
    it('accepts a value exactly at the min and max length', () => {
        expect(validateFieldValue('t', lengths, 'abc')).toEqual([]);
        expect(validateFieldValue('t', lengths, 'abcdefghij')).toEqual([]);
    });

    it('rejects one character under and one over the bounds', () => {
        expect(validateFieldValue('t', lengths, 'ab')).toEqual([
            { field: 't', message: 'must be at least 3 characters' }
        ]);
        expect(validateFieldValue('t', lengths, 'abcdefghijk')).toEqual([
            { field: 't', message: 'must be at most 10 characters' }
        ]);
    });

    // BUG-content-domain-04 / EC-13 — lengths are user-perceived characters,
    // not UTF-16 code units: a single emoji used to cost 2 and a family emoji 11.
    it('counts an emoji as one character against maxLength', () => {
        const oneChar: EntryFieldSpec = {
            type: CONTENT_FIELD_TYPE.Text,
            required: false,
            validation: { maxLength: 1 }
        };
        expect(validateFieldValue('t', oneChar, '👍')).toEqual([]);
        expect(validateFieldValue('t', oneChar, '👨‍👩‍👧‍👦')).toEqual([]);
        expect(validateFieldValue('t', oneChar, 'é')).toEqual([]);
        expect(validateFieldValue('t', oneChar, 'ab')).toEqual([
            { field: 't', message: 'must be at most 1 characters' }
        ]);
    });

    it('counts an emoji as one character against minLength', () => {
        const threeChars: EntryFieldSpec = {
            type: CONTENT_FIELD_TYPE.Text,
            required: false,
            validation: { minLength: 3 }
        };
        expect(validateFieldValue('t', threeChars, '👍👍')).toEqual([
            { field: 't', message: 'must be at least 3 characters' }
        ]);
        expect(validateFieldValue('t', threeChars, '👍👍👍')).toEqual([]);
    });

    it('matches an unanchored pattern anywhere in the value', () => {
        const spec: EntryFieldSpec = {
            type: CONTENT_FIELD_TYPE.Text,
            required: false,
            validation: { pattern: 'abc' }
        };
        expect(validateFieldValue('t', spec, 'xxabcxx')).toEqual([]);
    });

    // BUG-content-domain-06 — an author-supplied pattern is untrusted input.
    // `^(a+)+$` against 30 non-matching characters used to run for tens of
    // seconds; it is now refused up front, in constant time.
    it('refuses a pattern that risks catastrophic backtracking', () => {
        const spec: EntryFieldSpec = {
            type: CONTENT_FIELD_TYPE.Text,
            required: false,
            validation: { pattern: '^(a+)+$' }
        };
        const started = Date.now();
        expect(validateFieldValue('t', spec, `${'a'.repeat(40)}X`)).toEqual([
            { field: 't', message: 'has an unsafe pattern rule' }
        ]);
        expect(Date.now() - started).toBeLessThan(1000);
    });

    it('reports an uncompilable pattern instead of throwing out of the validator', () => {
        const spec: EntryFieldSpec = {
            type: CONTENT_FIELD_TYPE.Text,
            required: false,
            validation: { pattern: '(' }
        };
        expect(validateFieldValue('t', spec, 'abc')).toEqual([
            { field: 't', message: 'has an invalid pattern rule' }
        ]);
    });
});

describe('validateFieldValue — numbers and money', () => {
    const bounded: EntryFieldSpec = {
        type: CONTENT_FIELD_TYPE.Number,
        required: false,
        validation: { min: 0, max: 5 }
    };

    // EC-07 / EC-09 — inclusive bounds, and `min: 0` with the present value `0`.
    it('accepts a value exactly at the min and max bound', () => {
        expect(validateFieldValue('n', bounded, 0)).toEqual([]);
        expect(validateFieldValue('n', bounded, 5)).toEqual([]);
    });

    it('rejects a value just outside the bounds', () => {
        expect(validateFieldValue('n', bounded, -1)).toEqual([
            { field: 'n', message: 'must be ≥ 0' }
        ]);
        expect(validateFieldValue('n', bounded, 6)).toEqual([
            { field: 'n', message: 'must be ≤ 5' }
        ]);
    });

    // EC-10 — `Infinity` is a `number` that is not `NaN`; it can never reach a
    // numeric column.
    it.each([Infinity, -Infinity])('rejects %p as not finite', (value) => {
        expect(
            validateFieldValue(
                'n',
                { type: CONTENT_FIELD_TYPE.Number, required: false },
                value
            )
        ).toEqual([{ field: 'n', message: 'must be a finite number' }]);
    });

    // BUG-content-domain-05 — money was validated as a bare double, so a value
    // carrying more precision than a minor unit sailed through to be silently
    // rounded downstream.
    const money: EntryFieldSpec = {
        type: CONTENT_FIELD_TYPE.Money,
        required: false
    };

    it.each([0, 19.99, -19.99, 100, 0.5, 1e6])(
        'accepts %p as a money value',
        (value) => {
            expect(validateFieldValue('m', money, value)).toEqual([]);
        }
    );

    it.each([1.005, 19.999999, 0.1 + 0.2, 1e-7])(
        'rejects %p for exceeding two decimal places',
        (value) => {
            expect(validateFieldValue('m', money, value)).toEqual([
                { field: 'm', message: 'must have at most 2 decimal places' }
            ]);
        }
    );

    it('rejects a non-finite money value', () => {
        expect(validateFieldValue('m', money, Infinity)).toEqual([
            { field: 'm', message: 'must be a finite number' }
        ]);
    });
});

describe('validateFieldValue — dates and date-times', () => {
    const date: EntryFieldSpec = {
        type: CONTENT_FIELD_TYPE.Date,
        required: false
    };

    it.each(['2026-01-02', '2024-02-29', '2000-02-29', '2026-12-31'])(
        'accepts the real calendar date %s',
        (value) => {
            expect(validateFieldValue('d', date, value)).toEqual([]);
        }
    );

    it.each(['01-02-2026', '2026-1-2', '2026-01-02T00:00:00Z', 'nope'])(
        'rejects %s on shape',
        (value) => {
            expect(validateFieldValue('d', date, value)).toEqual([
                { field: 'd', message: 'must be an ISO date (YYYY-MM-DD)' }
            ]);
        }
    );

    // BUG-content-domain-02 / EC-12 — the shape regex alone accepted every one
    // of these.
    it.each([
        '2026-13-45',
        '2025-02-30',
        '2025-02-29',
        '2026-04-31',
        '0000-00-00',
        '2026-00-10',
        '2026-01-32'
    ])('rejects the calendar-impossible date %s', (value) => {
        expect(validateFieldValue('d', date, value)).toEqual([
            { field: 'd', message: 'must be a real calendar date' }
        ]);
    });

    it('rejects a Date instance in a date field', () => {
        expect(validateFieldValue('d', date, new Date())).toEqual([
            { field: 'd', message: 'must be an ISO date (YYYY-MM-DD)' }
        ]);
    });

    const datetime: EntryFieldSpec = {
        type: CONTENT_FIELD_TYPE.Datetime,
        required: false
    };

    it.each([
        '2026-01-02T03:04:05Z',
        '2026-01-02 03:04',
        '2026-01-02T03:04:05.123+02:00',
        '2026-01-02T03:04:05+0200'
    ])('accepts the date-time %s', (value) => {
        expect(validateFieldValue('dt', datetime, value)).toEqual([]);
    });

    it('accepts a valid Date instance', () => {
        expect(
            validateFieldValue('dt', datetime, new Date('2026-01-02T00:00:00Z'))
        ).toEqual([]);
    });

    // BUG-content-domain-03 — `new Date('nonsense')` is an `instanceof Date`,
    // so the type check alone waved it through; its time is `NaN`.
    it('rejects an Invalid Date instance', () => {
        expect(
            validateFieldValue('dt', datetime, new Date('nonsense'))
        ).toEqual([{ field: 'dt', message: 'must be an ISO date-time' }]);
    });
});

describe('validateFieldValue — relations', () => {
    // BUG-content-domain-07 — the `many` branch inside the Relation case was
    // unreachable (link-managed relations return before the switch). These pin
    // the reachable behaviour so removing it stays behaviour-preserving.
    it.each([[['nope']], ['bare-string'], [42], [{}]])(
        'skips a link-managed many relation whatever %p is in the bag',
        (value) => {
            expect(
                validateFieldValue(
                    'tags',
                    {
                        type: CONTENT_FIELD_TYPE.Relation,
                        required: true,
                        relation: { many: true }
                    },
                    value
                )
            ).toEqual([]);
        }
    );

    it('validates an owning single relation as a uuid', () => {
        const owning: EntryFieldSpec = {
            type: CONTENT_FIELD_TYPE.Relation,
            required: false,
            relation: { many: false }
        };
        expect(validateFieldValue('author', owning, UUID)).toEqual([]);
        expect(
            validateFieldValue('author', owning, UUID.toUpperCase())
        ).toEqual([]);
        // EC-17 — `UUID_RE` is anchored, so surrounding whitespace is invalid,
        // not trimmed away.
        expect(validateFieldValue('author', owning, ` ${UUID} `)).toEqual([
            { field: 'author', message: 'must be an entry id' }
        ]);
    });

    // EC-25 / EC-26 — a relation config that is falsy on both members is an
    // owning single relation.
    it.each([{}, { many: false }, { many: false, inverse: undefined }])(
        'treats the relation config %p as owning-single',
        (relation) => {
            expect(
                validateFieldValue(
                    'author',
                    {
                        type: CONTENT_FIELD_TYPE.Relation,
                        required: false,
                        relation
                    },
                    'nope'
                )
            ).toEqual([{ field: 'author', message: 'must be an entry id' }]);
        }
    );
});

describe('validateFieldValue — unknown field type', () => {
    // EC-23 — the switch has no `default`, so a typo in a field-type identifier
    // silently disables every rule for that field. Pinned so the behaviour is a
    // documented choice rather than a surprise.
    it('accepts any value on a type the switch does not know', () => {
        expect(
            validateFieldValue(
                'c',
                { type: 'colorpicker', required: false },
                { anything: true }
            )
        ).toEqual([]);
    });

    it('still enforces required on an unknown field type', () => {
        expect(
            validateFieldValue('c', { type: 'colorpicker', required: true }, '')
        ).toEqual([{ field: 'c', message: 'is required' }]);
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

describe('validateFieldValue — richtext', () => {
    /** The messages a value trips on a `richtext` field. */
    const check = (value: unknown, spec: Partial<EntryFieldSpec> = {}) =>
        validateFieldValue(
            'body',
            { type: CONTENT_FIELD_TYPE.RichText, required: false, ...spec },
            value
        ).map((issue) => issue.message);

    /** A `doc` around one paragraph of the given text. */
    const body = (text: string) => ({
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text }] }]
    });

    it('accepts a structured document', () => {
        expect(check(body('Hello'))).toEqual([]);
    });

    it('accepts a legacy HTML string', () => {
        // Bodies written before rich text became structured are stored as
        // HTML, and stay that way until the record is next saved.
        expect(check('<p>Hello</p>')).toEqual([]);
    });

    it('rejects a value that is neither', () => {
        expect(check(42)).toEqual(['must be a rich-text document']);
        expect(check({ type: 'paragraph' })).toEqual([
            'must be a rich-text document'
        ]);
        expect(check({ type: 'doc', content: ['nope'] })).toEqual([
            'must be a rich-text document'
        ]);
    });

    it('counts the body’s text, not its markup', () => {
        // The related symptom in ORT-84: bolding a word used to spend the
        // author's budget on `<strong></strong>`.
        const spec = { validation: { maxLength: 5 } };
        expect(check('<p>Hello</p>', spec)).toEqual([]);
        expect(check('<p><strong>Hello</strong></p>', spec)).toEqual([]);
        expect(
            check(
                {
                    type: 'doc',
                    content: [
                        {
                            type: 'paragraph',
                            content: [
                                {
                                    type: 'text',
                                    text: 'Hello',
                                    marks: [{ type: 'bold' }]
                                }
                            ]
                        }
                    ]
                },
                spec
            )
        ).toEqual([]);
        expect(check(body('Hello!'), spec)).toEqual([
            'must be at most 5 characters'
        ]);
    });

    it('matches a pattern against the text, for the same reason', () => {
        expect(
            check('<p>hello</p>', { validation: { pattern: '^[a-z]+$' } })
        ).toEqual([]);
    });

    it('trips required on the document an emptied editor leaves behind', () => {
        const spec = { required: true };
        expect(
            check({ type: 'doc', content: [{ type: 'paragraph' }] }, spec)
        ).toEqual(['is required']);
        expect(check('<p><br></p>', spec)).toEqual(['is required']);
        expect(check(body('Hi'), spec)).toEqual([]);
    });

    it('does not trip required on a body that means something without words', () => {
        expect(
            check(
                { type: 'doc', content: [{ type: 'table' }] },
                { required: true }
            )
        ).toEqual([]);
    });

    it('fails a structural error', () => {
        expect(check('<h2>A</h2><h4>B</h4>')).toEqual([
            'has a heading that skips from h2 to h4'
        ]);
        expect(check('<table><tr><td>a</td></tr></table>')).toEqual([
            'has a table with no header cells'
        ]);
        expect(check('<p lang="en_US">Hi</p>')).toEqual([
            'has an invalid language tag ("en_US")'
        ]);
    });

    it('never fails a structural warning', () => {
        // "click here" is poor link text, but whether a body means it badly is
        // not decidable from the string — the editor surfaces it, the gate
        // does not block on it.
        expect(check('<p><a href="/d">click here</a></p>')).toEqual([]);
    });

    it('can be opted out of, per field', () => {
        expect(
            check('<h2>A</h2><h4>B</h4>', { validation: { structure: 'off' } })
        ).toEqual([]);
    });

    it('sees what the ORT-84 repro reported as clean', () => {
        expect(
            check(
                '<h4>Intro</h4><h1>Title</h1><table><tr><td>a</td></tr></table>',
                { required: true }
            )
        ).toEqual(['has a table with no header cells']);
    });
});

describe('validateFieldValue — field language', () => {
    it('accepts a well-formed tag on any field', () => {
        expect(
            validateFieldValue(
                'motto',
                { type: CONTENT_FIELD_TYPE.Text, required: false, lang: 'la' },
                'Semper idem'
            )
        ).toEqual([]);
    });

    it('rejects a tag no user agent can parse, value or no value', () => {
        const spec: EntryFieldSpec = {
            type: CONTENT_FIELD_TYPE.Text,
            required: false,
            lang: 'latin_1'
        };
        expect(validateFieldValue('motto', spec, 'Semper idem')).toEqual([
            {
                field: 'motto',
                message: 'has an invalid language tag ("latin_1")'
            }
        ]);
        expect(validateFieldValue('motto', spec, null)).toEqual([
            {
                field: 'motto',
                message: 'has an invalid language tag ("latin_1")'
            }
        ]);
    });
});
