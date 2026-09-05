/**
 * The OpenAPI schemas of the **public** content API (`/api/v1/...`), kept apart
 * from the admin's for the same reason `types/public-entry.ts` is kept apart
 * from `EntryRecord`: this is a published contract an external site builds
 * against, and it must be free to stay still while the admin's shape moves.
 *
 * Splitting them is not tidiness. Until this module existed the document
 * described `/api/v1/content/{typeName}/{id}` with the **admin** entry schema,
 * because the route pattern in `describe-content-api.ts` matched both spellings
 * — so a consumer reading the reference was told a relation preview carries
 * `RelationRef`s (id + title) when the public API returns whole entries, and
 * that a media read is `Record<string, MediaRef[]>` when it is
 * `Record<string, { items, total }>`. A wrong schema is worse than an absent
 * one: the absent one sends you to curl, the wrong one does not.
 */

import type { SerializedContentType } from '../registry/content-type-registry';
import { CONTENT_FIELD_TYPE } from '../types/fields';
import { ENTRY_STATUS } from '../types/content-type';
import { fieldSchema, type OpenApiSchema } from './field-schema';
import { pascalCase, ref } from './content-schemas';

const UUID: OpenApiSchema = { type: 'string', format: 'uuid' };
const DATE_TIME: OpenApiSchema = { type: 'string', format: 'date-time' };

/** Schema names of one content type's public trio. */
export interface PublicTypeSchemaNames {
    /** The `values` bag — the entry's own data, references omitted. */
    values: string;
    /** One entry as the public API serves it. */
    entry: string;
    /** One page of them. */
    listPage: string;
}

/** The three schema names a content type contributes to the public document. */
export function publicSchemaNamesOf(
    type: SerializedContentType
): PublicTypeSchemaNames {
    const base = `Public${pascalCase(type.name)}`;
    return {
        values: `${base}Values`,
        entry: `${base}Entry`,
        listPage: `${base}ListPage`
    };
}

/**
 * Whether a field's value appears in a public entry's `values` bag.
 *
 * Mirrors `public-api/infrastructure/public-entry-row.ts`'s
 * `isPureValueField` — **every** reference kind is dropped, `relation` in all
 * four cardinalities and `media` alike, because the public read resolves
 * neither in `values` and a bare uuid is an identifier with nothing to follow.
 * Deliberately stricter than the admin's `isValueField`, which keeps an owning
 * single relation's FK.
 */
function isPublicValueField(field: { type: string }): boolean {
    return (
        field.type !== CONTENT_FIELD_TYPE.Relation &&
        field.type !== CONTENT_FIELD_TYPE.Media
    );
}

/** The `values` bag of one content type, as the public API serves it. */
function publicValuesSchema(type: SerializedContentType): OpenApiSchema {
    const fields = type.fields.filter(isPublicValueField);
    const omitted = type.fields
        .filter((field) => !isPublicValueField(field))
        .map((field) => field.name);

    const properties: Record<string, OpenApiSchema> = {};
    for (const field of fields) {
        properties[field.name] = fieldSchema(field);
    }

    const notes = [
        `Field values keyed by field name, for one \`${type.name}\` entry.`,
        'An unset field reads back as `null`, never as a missing key — except under a `?fields=` sparse fieldset, where only the requested keys are present at all.',
        omitted.length
            ? `Reference fields (${omitted
                  .map((name) => `\`${name}\``)
                  .join(
                      ', '
                  )}) are **not** in this bag: read relations through \`?relations=preview\` or the \`/relations/{field}\` route, and media through \`?media=preview\` or \`/media\`. The schema endpoint still describes them, because they are part of the real model.`
            : ''
    ].filter(Boolean);

    return {
        type: 'object',
        title: `${type.label} values (public)`,
        description: notes.join(' '),
        properties,
        // No `required`: a sparse fieldset may narrow the bag to one key, and a
        // publishable type's "required" fields are required to publish rather
        // than to exist.
        additionalProperties: false
    };
}

/** One entry of a content type, as the public API serves it. */
function publicEntrySchema(
    type: SerializedContentType,
    names: PublicTypeSchemaNames
): OpenApiSchema {
    const properties: Record<string, OpenApiSchema> = {
        id: { ...UUID, description: 'Entry id.' },
        ...(type.publishable
            ? {
                  status: {
                      type: 'string',
                      enum: Object.values(ENTRY_STATUS),
                      description:
                          'Publish state. A read-only token only ever sees `published`; a write-scoped one can create a draft and read it back with `?status=`.'
                  },
                  publishedAt: {
                      ...DATE_TIME,
                      nullable: true,
                      description:
                          'When this entry last went live. `draft` together with a non-null `publishedAt` is live content carrying unpublished edits — neither field alone tells those apart.'
                  }
              }
            : {}),
        createdAt: DATE_TIME,
        updatedAt: DATE_TIME,
        ...(type.i18n
            ? {
                  locale: {
                      type: 'string',
                      description: 'Locale slug of this row.'
                  },
                  localeGroupId: {
                      ...UUID,
                      description:
                          'Translation group — this row’s siblings in other locales share it, and it is the id the `/group/{localeGroupId}` routes take.'
                  }
              }
            : {}),
        values: ref(names.values),
        relations: {
            type: 'object',
            additionalProperties: ref('PublicRelationFieldPage'),
            description:
                'Relation links keyed by field name — present only with `?relations=preview`. Each linked record is a whole entry, not a ref.'
        },
        media: {
            type: 'object',
            additionalProperties: ref('PublicMediaFieldPage'),
            description:
                'Media assets keyed by field name — present only with `?media=preview`.'
        },
        ...(type.i18n
            ? {
                  translations: {
                      type: 'array',
                      items: ref(names.entry),
                      description:
                          'The entry’s **other** published locale rows — present only with `?translations=preview`. The entry itself is not repeated, and the siblings are not themselves expanded.'
                  }
              }
            : {})
    };

    return {
        type: 'object',
        title: `${type.label} (public)`,
        description: `One \`${type.name}\` entry on the public API.`,
        properties,
        required: [
            'id',
            'createdAt',
            'updatedAt',
            'values',
            ...(type.publishable ? ['status', 'publishedAt'] : []),
            ...(type.i18n ? ['locale', 'localeGroupId'] : [])
        ]
    };
}

/** One page of public entries of a content type. */
function publicListPageSchema(
    type: SerializedContentType,
    names: PublicTypeSchemaNames
): OpenApiSchema {
    return {
        type: 'object',
        title: `${type.label} page (public)`,
        description: `One page of \`${type.name}\` entries. \`total\` counts every match, ignoring pagination.`,
        properties: {
            items: { type: 'array', items: ref(names.entry) },
            total: { type: 'integer' },
            page: {
                type: 'integer',
                description: '1-based page number this page represents.'
            },
            pageSize: {
                type: 'integer',
                description: 'Rows per page actually applied.'
            }
        },
        required: ['items', 'total', 'page', 'pageSize']
    };
}

/**
 * The public per-type entry schemas as alternatives — the response shape
 * depends on `typeName`, which OpenAPI cannot express as a dependency. One
 * registered type needs no union; none at all leaves an open object, since
 * every one of these routes 404s anyway.
 *
 * `anyOf` rather than `oneOf`, for the reason `unionOf` in
 * `describe-content-api.ts` spells out: the alternatives overlap, and *exactly
 * one* is a promise the API does not keep.
 */
export function publicUnionOf(names: string[]): OpenApiSchema {
    if (!names.length) return { type: 'object', additionalProperties: true };
    return names.length === 1
        ? ref(names[0])
        : { anyOf: names.map((name) => ref(name)) };
}

/**
 * The public API's fixed shapes — the ones that do not vary by content type,
 * except where an entry appears inside them.
 *
 * `entryUnion` is threaded in rather than referenced by name because a relation
 * page and a translation list carry whole entries, and which entries those are
 * is the registry's answer, not this module's.
 */
function publicSharedSchemas(
    entryUnion: OpenApiSchema
): Record<string, OpenApiSchema> {
    return {
        PublicMediaTrack: {
            type: 'object',
            description:
                'One timed-text track on a published video or audio asset — everything a `<track>` element needs.',
            properties: {
                kind: {
                    type: 'string',
                    description:
                        '`captions` / `subtitles` / `descriptions` / `chapters`.'
                },
                srclang: {
                    type: 'string',
                    description: 'BCP-47 tag of the track’s language.'
                },
                label: {
                    type: 'string',
                    description: 'What a player shows in its track menu.'
                },
                src: {
                    type: 'string',
                    description:
                        'Route the WebVTT bytes stream from — same bearer token as the read.'
                },
                default: {
                    type: 'boolean',
                    description:
                        'Whether a player should enable this track by default.'
                }
            },
            required: ['kind', 'srclang', 'label', 'src']
        },
        PublicMediaRef: {
            type: 'object',
            description:
                'One attached asset. The URLs take the **same bearer token** as the read that produced them, so a server-side consumer can fetch the bytes with the credential it already holds — but a browser `<img src>` sends no `Authorization` header and will not load one. Proxy them from whatever holds the token.',
            properties: {
                id: UUID,
                name: {
                    type: 'string',
                    description: 'Display name — the original file name.'
                },
                url: {
                    type: 'string',
                    description: 'Route the original bytes stream from.'
                },
                thumbUrl: {
                    type: 'string',
                    description:
                        '~320px derivative, when one was generated (absent for non-images, SVGs, and images too small to derive).'
                },
                previewUrl: {
                    type: 'string',
                    description: '~1280px derivative, same caveats.'
                },
                kind: {
                    type: 'string',
                    description:
                        'Coarse kind — image / video / audio / document / archive.'
                },
                mimeType: { type: 'string' },
                alt: {
                    type: 'string',
                    nullable: true,
                    description:
                        'The text alternative for **this usage**. `""` and `null` mean different things: `""` is “render `alt=""`, this image says nothing”, `null` is “nobody supplied one” — a gap to report, not an instruction to hide the image from assistive tech.'
                },
                decorative: {
                    type: 'boolean',
                    enum: [true],
                    description:
                        'Present, and always `true`, when the author marked this usage purely presentational.'
                },
                tracks: {
                    type: 'array',
                    items: ref('PublicMediaTrack'),
                    description:
                        'Empty for an image, and for a video nobody has captioned.'
                }
            },
            required: ['id', 'name', 'url', 'kind', 'mimeType', 'alt', 'tracks']
        },
        PublicMediaFieldPage: {
            type: 'object',
            description: 'One media field’s assets, in their stored order.',
            properties: {
                items: { type: 'array', items: ref('PublicMediaRef') },
                total: {
                    type: 'integer',
                    description: 'Assets attached to this field.'
                }
            },
            required: ['items', 'total']
        },
        PublicEntryMedia: {
            type: 'object',
            description: 'Every media field of the entry, keyed by field name.',
            properties: {
                media: {
                    type: 'object',
                    additionalProperties: ref('PublicMediaFieldPage')
                }
            },
            required: ['media']
        },
        PublicRelationFieldPage: {
            type: 'object',
            description:
                'One relation field’s links: a capped page plus the true total. Each item is a **whole entry**, envelope and `values` alike — not a ref — so a consumer renders a linked record with the code it already has. Linked entries are not themselves expanded. A target the caller may not see is omitted **and not counted**, so `total` is the number of links actually reachable.',
            properties: {
                items: { type: 'array', items: entryUnion },
                total: {
                    type: 'integer',
                    description:
                        'Visible links for this field, ignoring the page cap.'
                }
            },
            required: ['items', 'total']
        },
        PublicEntryTranslations: {
            type: 'object',
            description:
                'The entry’s other published locale rows, ordered by locale slug. The entry itself is not repeated, and a locale that exists only as a draft is absent.',
            properties: {
                translations: { type: 'array', items: entryUnion }
            },
            required: ['translations']
        },
        PublicContentTypeList: {
            type: 'object',
            description:
                'Every content type granted to the requested workspace — exactly the set of `typeName`s that will not 404.',
            properties: {
                items: { type: 'array', items: ref('ContentTypeSummary') }
            },
            required: ['items']
        },
        PublicBulkError: {
            type: 'object',
            description:
                'Why one item of a batch did not go through, carrying **the status the same write would have failed with on its own** (404, 422, 400) rather than a bulk-specific vocabulary.',
            properties: {
                status: { type: 'integer' },
                message: { type: 'string' },
                issues: {
                    type: 'array',
                    items: ref('ValidationIssue'),
                    description: 'The per-field issues of a 422.'
                }
            },
            required: ['status', 'message']
        },
        PublicBulkSaveItemResult: {
            type: 'object',
            description:
                'What became of one submitted item, positionally matched to the request.',
            properties: {
                index: {
                    type: 'integer',
                    description: '0-based position in the submitted `items`.'
                },
                op: { type: 'string', enum: ['create', 'update'] },
                ok: { type: 'boolean' },
                entry: entryUnion,
                error: ref('PublicBulkError')
            },
            required: ['index', 'op', 'ok']
        },
        PublicBulkSaveResult: {
            type: 'object',
            description:
                '**Partial success is the contract**, not a degraded mode: items are written one transaction at a time, so the call is a 200 with per-item verdicts whether or not every item saved, and a caller retries the failures it can fix.',
            properties: {
                items: {
                    type: 'array',
                    items: ref('PublicBulkSaveItemResult')
                },
                created: { type: 'integer' },
                updated: { type: 'integer' },
                failed: { type: 'integer' }
            },
            required: ['items', 'created', 'updated', 'failed']
        }
    };
}

/**
 * Every schema the public API contributes: its fixed shapes plus, per
 * registered content type, the `Values` / `Entry` / `ListPage` trio.
 */
export function buildPublicApiSchemas(
    types: readonly SerializedContentType[]
): Record<string, OpenApiSchema> {
    const entryUnion = publicUnionOf(
        types.map((type) => publicSchemaNamesOf(type).entry)
    );
    const schemas = publicSharedSchemas(entryUnion);
    for (const type of types) {
        const names = publicSchemaNamesOf(type);
        schemas[names.values] = publicValuesSchema(type);
        schemas[names.entry] = publicEntrySchema(type, names);
        schemas[names.listPage] = publicListPageSchema(type, names);
    }
    return schemas;
}
