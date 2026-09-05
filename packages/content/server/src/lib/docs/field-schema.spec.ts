import { fieldSchema, isValueField } from './field-schema';
import type { SerializedField } from '../registry/content-type-registry';

/** A serialized field with the boilerplate filled in. */
function field(overrides: Partial<SerializedField>): SerializedField {
    return {
        name: 'title',
        type: 'text',
        required: false,
        validation: {},
        admin: {},
        ...overrides
    };
}

describe('fieldSchema', () => {
    it('maps text with its validation bounds', () => {
        expect(
            fieldSchema(
                field({
                    type: 'text',
                    validation: { minLength: 3, maxLength: 80, pattern: '^a' }
                })
            )
        ).toMatchObject({
            type: 'string',
            minLength: 3,
            maxLength: 80,
            pattern: '^a'
        });
    });

    it('maps a whole-number field to `integer`, renaming min/max', () => {
        expect(
            fieldSchema(
                field({
                    type: 'number',
                    validation: { integer: true, min: 1, max: 10 }
                })
            )
        ).toMatchObject({ type: 'integer', minimum: 1, maximum: 10 });
    });

    it('maps a non-integer number to `number`', () => {
        expect(fieldSchema(field({ type: 'number' }))).toMatchObject({
            type: 'number'
        });
    });

    it('maps date and datetime to their string formats', () => {
        expect(fieldSchema(field({ type: 'date' }))).toMatchObject({
            type: 'string',
            format: 'date'
        });
        expect(fieldSchema(field({ type: 'datetime' }))).toMatchObject({
            type: 'string',
            format: 'date-time'
        });
    });

    it('carries a select’s options as an enum, `null` among them', () => {
        // `nullable: true` does NOT widen an enum — OAS 3.0 wants `null`
        // listed. Without it the document rejected an entry with an unset
        // select, which is every draft: measured against a live server, an
        // `article` with `layout: null` failed its own `ArticleValues`.
        expect(
            fieldSchema(field({ type: 'select', options: ['a', 'b'] }))
        ).toMatchObject({
            type: 'string',
            enum: ['a', 'b', null],
            nullable: true
        });
    });

    it('makes a richtext body nullable through its `oneOf`, not beside it', () => {
        // Same defect, other shape: `nullable` modifies a schema's `type`, and
        // a bare `oneOf` has none for it to modify.
        const schema = fieldSchema(field({ type: 'richtext' }));
        expect(schema['oneOf']).toContainEqual({ type: 'null' });
        expect(schema['nullable']).toBe(true);
    });

    it('leaves a plainly-typed field to `nullable` alone', () => {
        const schema = fieldSchema(field({ type: 'text' }));
        expect(schema).toMatchObject({ type: 'string', nullable: true });
        expect(schema['enum']).toBeUndefined();
        expect(schema['oneOf']).toBeUndefined();
    });

    it('maps multiselect to an array of the enum', () => {
        expect(
            fieldSchema(field({ type: 'multiselect', options: ['a', 'b'] }))
        ).toMatchObject({
            type: 'array',
            items: { type: 'string', enum: ['a', 'b'] }
        });
    });

    it('leaves a json field unconstrained — the column holds any JSON', () => {
        const schema = fieldSchema(field({ type: 'json' }));
        expect(schema['type']).toBeUndefined();
        expect(schema['description']).toContain('Arbitrary JSON');
    });

    it('maps a single relation to a uuid naming its target', () => {
        const schema = fieldSchema(
            field({
                name: 'author',
                type: 'relation',
                relation: { to: 'author', many: false }
            })
        );
        expect(schema).toMatchObject({ type: 'string', format: 'uuid' });
        expect(schema['description']).toContain('`author`');
    });

    it('maps a multiple media field to an array of uuids', () => {
        expect(
            fieldSchema(field({ type: 'media', multiple: true }))
        ).toMatchObject({
            type: 'array',
            items: { type: 'string', format: 'uuid' }
        });
    });

    it('is always nullable — an unset field reads back as null', () => {
        expect(fieldSchema(field({ required: true }))['nullable']).toBe(true);
    });

    it('uses the admin label as the title and notes localization', () => {
        const schema = fieldSchema(
            field({ admin: { label: 'Headline' }, localized: true })
        );
        expect(schema['title']).toBe('Headline');
        expect(schema['description']).toContain('Localized');
    });
});

describe('isValueField', () => {
    it('keeps scalars and owning single relations', () => {
        expect(isValueField(field({ type: 'text' }))).toBe(true);
        expect(
            isValueField(
                field({
                    type: 'relation',
                    relation: { to: 'author', many: false }
                })
            )
        ).toBe(true);
    });

    it('drops the join-backed relations — their links never ride the bag', () => {
        expect(
            isValueField(
                field({ type: 'relation', relation: { to: 'tag', many: true } })
            )
        ).toBe(false);
        expect(
            isValueField(
                field({
                    type: 'relation',
                    relation: {
                        to: 'comment',
                        many: true,
                        inverse: { field: 'article' }
                    }
                })
            )
        ).toBe(false);
    });
});
