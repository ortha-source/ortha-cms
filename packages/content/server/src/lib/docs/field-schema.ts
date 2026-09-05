/**
 * Field spec → JSON Schema. The pure half of the OpenAPI description: given one
 * serialized field, produce the schema its value takes on the wire.
 *
 * No NestJS, no registry, no document — just the mapping, so the table below is
 * unit-testable on its own.
 */

import { CONTENT_FIELD_TYPE } from '../types/fields';
import type { SerializedField } from '../registry/content-type-registry';

/** A JSON Schema fragment, as it appears in the OpenAPI document. */
export type OpenApiSchema = Record<string, unknown>;

/** The `uuid`-shaped string every id value takes. */
const UUID_SCHEMA: OpenApiSchema = { type: 'string', format: 'uuid' };

/**
 * A rich-text body: the **document** the editor produces, or — for a body
 * written before rich text became structured, and not yet re-saved — the HTML
 * string it is still stored as. Both are accepted on a write and either may
 * come back on a read, which is what `oneOf` says here.
 *
 * The node tree is described one level deep and left open (`additionalProperties`
 * on `attrs`, a self-`$ref`-free `content`): the node vocabulary is the
 * editor's, not this schema's, and pinning it here would make every editor
 * extension a change to the published API description.
 *
 * `minLength`/`maxLength` are deliberately **not** copied onto it. They are
 * real rules, but they count the body's *text*, and a JSON Schema `maxLength`
 * on this value would be read as a bound on the serialized document — a
 * different, wrong promise. The field's description carries them in words.
 */
const RICH_TEXT_SCHEMA: OpenApiSchema = {
    oneOf: [
        {
            type: 'object',
            title: 'RichTextDocument',
            required: ['type'],
            properties: {
                type: { type: 'string', enum: ['doc'] },
                content: {
                    type: 'array',
                    items: {
                        type: 'object',
                        required: ['type'],
                        properties: {
                            type: { type: 'string' },
                            attrs: {
                                type: 'object',
                                additionalProperties: true
                            },
                            marks: { type: 'array', items: { type: 'object' } },
                            text: { type: 'string' },
                            content: {
                                type: 'array',
                                items: { type: 'object' }
                            }
                        },
                        additionalProperties: true
                    }
                }
            },
            additionalProperties: true
        },
        { type: 'string', description: 'Legacy HTML body (read-compatible).' }
    ]
};

/**
 * The schema of a field's **value**, before the nullability and description
 * wrapping {@link fieldSchema} adds.
 *
 * A `json` field deliberately produces `{}` — "any JSON" — rather than
 * `type: 'object'`: the column holds whatever the author stores, arrays and
 * scalars included.
 */
function valueSchema(field: SerializedField): OpenApiSchema {
    const { validation } = field;
    switch (field.type) {
        case CONTENT_FIELD_TYPE.Text:
            return {
                type: 'string',
                ...pick(validation, ['minLength', 'maxLength']),
                ...(typeof validation['pattern'] === 'string'
                    ? { pattern: validation['pattern'] }
                    : {})
            };
        case CONTENT_FIELD_TYPE.RichText:
            return RICH_TEXT_SCHEMA;
        case CONTENT_FIELD_TYPE.Number:
            return {
                type: validation['integer'] === true ? 'integer' : 'number',
                ...renameBounds(validation)
            };
        case CONTENT_FIELD_TYPE.Money:
            return { type: 'number', ...renameBounds(validation) };
        case CONTENT_FIELD_TYPE.Boolean:
            return { type: 'boolean' };
        case CONTENT_FIELD_TYPE.Date:
            return { type: 'string', format: 'date' };
        case CONTENT_FIELD_TYPE.Datetime:
            return { type: 'string', format: 'date-time' };
        case CONTENT_FIELD_TYPE.Select:
            return {
                type: 'string',
                ...(field.options ? { enum: [...field.options] } : {})
            };
        case CONTENT_FIELD_TYPE.Multiselect:
            return {
                type: 'array',
                items: {
                    type: 'string',
                    ...(field.options ? { enum: [...field.options] } : {})
                }
            };
        case CONTENT_FIELD_TYPE.Json:
            return {};
        case CONTENT_FIELD_TYPE.Relation:
            // Only an owning **single** relation rides the values bag, as its
            // raw FK; the join-backed kinds never reach here (the caller drops
            // them, mirroring `toRecord`).
            return UUID_SCHEMA;
        case CONTENT_FIELD_TYPE.Media:
            return field.multiple
                ? { type: 'array', items: UUID_SCHEMA }
                : UUID_SCHEMA;
        default:
            return {};
    }
}

/** Copies the listed numeric validation keys through, when present. */
function pick(
    validation: Record<string, unknown>,
    keys: string[]
): OpenApiSchema {
    const out: OpenApiSchema = {};
    for (const key of keys) {
        if (typeof validation[key] === 'number') {
            out[key] = validation[key];
        }
    }
    return out;
}

/** One numeric validation rule off a field, when it has one. */
function validationNumber(
    field: SerializedField,
    key: string
): number | undefined {
    const value = field.validation[key];
    return typeof value === 'number' ? value : undefined;
}

/** `min`/`max` are JSON Schema's `minimum`/`maximum`. */
function renameBounds(validation: Record<string, unknown>): OpenApiSchema {
    const out: OpenApiSchema = {};
    if (typeof validation['min'] === 'number')
        out['minimum'] = validation['min'];
    if (typeof validation['max'] === 'number')
        out['maximum'] = validation['max'];
    return out;
}

/**
 * Whether the field's value travels in the `values` bag at all. A many-relation
 * and an inverse back-reference own no column — their links live in join tables
 * and are read through the relation routes — so they are absent from a record's
 * `values`, exactly as `toRecord` builds it.
 */
export function isValueField(field: SerializedField): boolean {
    return !(
        field.type === CONTENT_FIELD_TYPE.Relation &&
        (field.relation?.many || field.relation?.inverse)
    );
}

/**
 * The documented schema of one field: its value schema plus the presentation
 * facts a reader needs — the admin label as `title`, help text and the
 * relation/localization notes as `description`.
 *
 * Every property is `nullable`: an unset field reads back as `null`, and on a
 * publishable type even a required one may legitimately be empty in a draft
 * (required means "required *to publish*").
 */
export function fieldSchema(field: SerializedField): OpenApiSchema {
    const notes: string[] = [];
    if (typeof field.admin['description'] === 'string') {
        notes.push(field.admin['description']);
    }
    if (field.relation) {
        notes.push(
            `Id of the related \`${field.relation.to}\` entry${
                field.relation.unique ? ' (one-to-one)' : ''
            }.`
        );
    }
    if (field.type === CONTENT_FIELD_TYPE.Media) {
        notes.push(
            field.multiple
                ? 'Ordered media-asset ids.'
                : 'Media-asset id (`GET /api/media/assets/{id}/raw` serves the bytes).'
        );
    }
    if (field.localized) {
        notes.push('Localized — varies per locale row.');
    }
    if (field.type === CONTENT_FIELD_TYPE.Json) {
        notes.push('Arbitrary JSON.');
    }
    if (field.type === CONTENT_FIELD_TYPE.RichText) {
        notes.push(
            'Rich text as a structured document (ProseMirror/TipTap JSON); a ' +
                'legacy HTML string is still accepted and still read back until ' +
                'the entry is next saved from the editor.'
        );
        const min = validationNumber(field, 'minLength');
        const max = validationNumber(field, 'maxLength');
        if (min !== undefined || max !== undefined) {
            // Said in words rather than as a JSON Schema `maxLength`, which
            // would bound the serialized document instead of the prose.
            notes.push(
                `Length rules count the body's text, not its markup${
                    min !== undefined ? `; at least ${min} characters` : ''
                }${max !== undefined ? `; at most ${max} characters` : ''}.`
            );
        }
    }
    if (field.lang) {
        notes.push(`Written in \`${field.lang}\` (BCP-47).`);
    }

    const label =
        typeof field.admin['label'] === 'string'
            ? field.admin['label']
            : undefined;

    return {
        ...nullable(valueSchema(field)),
        ...(label ? { title: label } : {}),
        ...(notes.length ? { description: notes.join(' ') } : {})
    };
}

/**
 * Marks a value schema nullable — and does the two things `nullable: true`
 * alone does **not** do.
 *
 * OpenAPI 3.0's `nullable` is a modifier on the schema's `type`, so it is inert
 * wherever there is no single type to modify, and it does not widen an
 * enumeration. Both cases occur here and both produced a document that rejected
 * responses the API really returns:
 *
 * - a `select` read back as `{ type: 'string', enum: [...], nullable: true }`,
 *   which every validator refuses `null` against, because OAS 3.0 requires a
 *   nullable enum to list `null` among its values;
 * - a `richtext` read back as a bare `oneOf` (document or legacy HTML string)
 *   with `nullable` attached to nothing at all.
 *
 * Measured against a live server: an `article` with an unset `layout` did not
 * validate against its own `ArticleValues` schema until this existed.
 */
function nullable(schema: OpenApiSchema): OpenApiSchema {
    if (Array.isArray(schema['oneOf'])) {
        return {
            ...schema,
            oneOf: [...(schema['oneOf'] as OpenApiSchema[]), { type: 'null' }],
            nullable: true
        };
    }
    if (Array.isArray(schema['enum'])) {
        return {
            ...schema,
            enum: [...(schema['enum'] as unknown[]), null],
            nullable: true
        };
    }
    return { ...schema, nullable: true };
}
