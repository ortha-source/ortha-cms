/**
 * The OpenAPI schemas this plugin contributes: one set **per registered content
 * type** (generated from the registry) plus the fixed shapes its routes share.
 *
 * Content types are code-defined runtime data, not decorated classes, so
 * `@nestjs/swagger` cannot see them. This module is how they become visible.
 */

import { ENTRY_STATUS } from '../types/content-type';
import { REVISION_STATUS } from '../revisions/domain/revision-status';
import type { SerializedContentType } from '../registry/content-type-registry';
import { fieldSchema, isValueField, type OpenApiSchema } from './field-schema';

/** Schema names of one content type's generated trio. */
export interface TypeSchemaNames {
    /** The `values` bag — one property per column-backed field. */
    values: string;
    /** One entry: the storage envelope wrapping {@link values}. */
    entry: string;
    /** One page of entries. */
    listPage: string;
}

const UUID: OpenApiSchema = { type: 'string', format: 'uuid' };
const DATE_TIME: OpenApiSchema = { type: 'string', format: 'date-time' };

/** `#/components/schemas/<name>`. */
export function ref(name: string): OpenApiSchema {
    return { $ref: `#/components/schemas/${name}` };
}

/**
 * `article` → `Article`, `seo_meta` → `SeoMeta`. Content-type names are
 * snake_case machine names; schema names are the PascalCase convention the rest
 * of the document uses.
 */
export function pascalCase(name: string): string {
    return name
        .split(/[^a-zA-Z0-9]+/)
        .filter(Boolean)
        .map((part) => part[0].toUpperCase() + part.slice(1))
        .join('');
}

/** The three schema names a content type contributes. */
export function schemaNamesOf(type: SerializedContentType): TypeSchemaNames {
    const base = pascalCase(type.name);
    return {
        values: `${base}Values`,
        entry: `${base}Entry`,
        listPage: `${base}ListPage`
    };
}

/** A one-line summary of a type's envelope flags, for the schema description. */
function envelopeNote(type: SerializedContentType): string {
    const traits = [
        type.publishable ? 'publishable (`status` + `publishedAt`)' : null,
        type.paranoid ? 'soft-deleted (`?deleted=only` lists the trash)' : null,
        type.i18n
            ? 'localized (one row per locale, `localeGroupId` shared)'
            : null
    ].filter(Boolean);
    return traits.length ? ` This type is ${traits.join(', ')}.` : '';
}

/** The `values` bag of one content type. */
function valuesSchema(type: SerializedContentType): OpenApiSchema {
    const fields = type.fields.filter(isValueField);
    const linkManaged = type.fields
        .filter((field) => !isValueField(field))
        .map((field) => field.name);

    const properties: Record<string, OpenApiSchema> = {};
    for (const field of fields) {
        properties[field.name] = fieldSchema(field);
    }

    // A publishable type's required fields are required *to publish*, not to
    // save — a draft may legitimately be incomplete — so they are only listed
    // as `required` on a type that is always live.
    const required = type.publishable
        ? []
        : fields.filter((field) => field.required).map((field) => field.name);

    const notes = [
        `Field values keyed by field name, for one \`${type.name}\` entry.`,
        type.publishable
            ? 'Fields marked required in the content type are required **to publish**, not to save, so a draft may omit them.'
            : '',
        linkManaged.length
            ? `Link-managed relations (${linkManaged
                  .map((name) => `\`${name}\``)
                  .join(
                      ', '
                  )}) are not part of this bag — their links live in join tables; read them via \`/relations\` and write them with the \`relations\` delta on a save.`
            : ''
    ].filter(Boolean);

    return {
        type: 'object',
        title: `${type.label} values`,
        description: notes.join(' '),
        properties,
        ...(required.length ? { required } : {}),
        additionalProperties: false
    };
}

/** One entry of a content type: the storage envelope plus its values. */
function entrySchema(
    type: SerializedContentType,
    names: TypeSchemaNames
): OpenApiSchema {
    const properties: Record<string, OpenApiSchema> = {
        id: { ...UUID, description: 'Entry id.' },
        ...(type.publishable
            ? {
                  status: {
                      type: 'string',
                      enum: Object.values(ENTRY_STATUS),
                      description: 'Publish state.'
                  },
                  publishedAt: {
                      ...DATE_TIME,
                      nullable: true,
                      description:
                          'When this entry last went live, or `null` if it never has. Survives an edit, so `draft` + a `publishedAt` means "live content with unpublished changes".'
                  }
              }
            : {}),
        ...(type.i18n
            ? {
                  locale: {
                      type: 'string',
                      description: 'Locale slug of this row.'
                  },
                  localeGroupId: {
                      ...UUID,
                      description:
                          'Translation group — the sibling rows of this entry in other locales share it.'
                  }
              }
            : {}),
        createdAt: DATE_TIME,
        updatedAt: DATE_TIME,
        values: ref(names.values),
        relations: {
            type: 'object',
            additionalProperties: ref('RelationFieldPage'),
            description:
                'Capped relation preview, keyed by relation field — present only with `?relations=preview&relationFields=…`.'
        }
    };

    return {
        type: 'object',
        title: type.label,
        description: `One \`${type.name}\` entry.${envelopeNote(type)}`,
        properties,
        required: [
            'id',
            'createdAt',
            'updatedAt',
            'values',
            ...(type.publishable ? ['status'] : []),
            ...(type.i18n ? ['locale', 'localeGroupId'] : [])
        ]
    };
}

/** One page of a content type's entries. */
function listPageSchema(
    type: SerializedContentType,
    names: TypeSchemaNames
): OpenApiSchema {
    return {
        type: 'object',
        title: `${type.label} page`,
        description: `One page of \`${type.name}\` entries. \`total\` is the count across all pages.`,
        properties: {
            items: { type: 'array', items: ref(names.entry) },
            total: { type: 'integer' },
            page: { type: 'integer' },
            pageSize: { type: 'integer' }
        },
        required: ['items', 'total', 'page', 'pageSize']
    };
}

/**
 * The shapes every content route shares, whatever the type — relation/media
 * refs, the bulk results, revisions, and the content-schema read models.
 */
function sharedSchemas(): Record<string, OpenApiSchema> {
    return {
        RelationRef: {
            type: 'object',
            description:
                'One linked record, resolved for display. A link whose target cannot be resolved (soft-deleted, or outside the workspace) is returned id-only and flagged `missing`, so `items` never runs shorter than `total`.',
            properties: {
                id: UUID,
                title: {
                    type: 'string',
                    description:
                        'Display title (first text/select field, else the id).'
                },
                slug: {
                    type: 'string',
                    description:
                        "The target's slug-field value, when it has one."
                },
                status: {
                    type: 'string',
                    enum: Object.values(ENTRY_STATUS),
                    description: 'Only for a publishable target type.'
                },
                missing: {
                    type: 'boolean',
                    description: 'The target could not be resolved.'
                }
            },
            required: ['id', 'title']
        },
        MediaRef: {
            type: 'object',
            description:
                'One attached asset, resolved for display. Mirrors `RelationRef`: an unresolvable asset is id-only and flagged `missing`.',
            properties: {
                id: UUID,
                name: { type: 'string' },
                url: {
                    type: 'string',
                    description: 'Raw-stream route for the original bytes.'
                },
                thumbUrl: {
                    type: 'string',
                    description:
                        '~320px derivative, when one was generated (absent for non-images, SVGs, and images too small to derive).'
                },
                previewUrl: {
                    type: 'string',
                    description:
                        '~1280px derivative, same caveats as `thumbUrl`.'
                },
                kind: {
                    type: 'string',
                    description:
                        'Coarse kind — image/video/audio/document/archive.'
                },
                mimeType: { type: 'string' },
                alt: { type: 'string', nullable: true },
                missing: { type: 'boolean' }
            },
            required: ['id', 'name', 'url', 'kind', 'mimeType']
        },
        RelationFieldPage: {
            type: 'object',
            description:
                "One relation field's links: a windowed page of refs plus the total across the whole set.",
            properties: {
                items: { type: 'array', items: ref('RelationRef') },
                total: { type: 'integer' }
            },
            required: ['items', 'total']
        },
        EntryRelations: {
            type: 'object',
            description:
                "Every relation field's first page of links, keyed by field name.",
            properties: {
                relations: {
                    type: 'object',
                    additionalProperties: ref('RelationFieldPage')
                }
            },
            required: ['relations']
        },
        EntryMedia: {
            type: 'object',
            description:
                "Every media field's attached assets, keyed by field name. Empty when no media resolver is bound.",
            properties: {
                media: {
                    type: 'object',
                    additionalProperties: {
                        type: 'array',
                        items: ref('MediaRef')
                    }
                }
            },
            required: ['media']
        },
        ValidationIssue: {
            type: 'object',
            description:
                'One field-level validation failure (the body of a 422).',
            properties: {
                field: { type: 'string' },
                message: { type: 'string' }
            },
            required: ['field', 'message']
        },
        BulkPublishCheck: {
            type: 'object',
            description:
                "One field's publish-gate check — passed fields included, so the admin can show a full checklist.",
            properties: {
                field: { type: 'string' },
                label: { type: 'string' },
                ok: { type: 'boolean' },
                message: {
                    type: 'string',
                    description: 'The failure message when `ok` is false.'
                }
            },
            required: ['field', 'label', 'ok']
        },
        BulkPublishVerdict: {
            type: 'object',
            properties: {
                id: UUID,
                title: { type: 'string' },
                status: {
                    type: 'string',
                    enum: Object.values(ENTRY_STATUS),
                    nullable: true,
                    description:
                        'Current publish state, or `null` when not found.'
                },
                verdict: {
                    type: 'string',
                    enum: [
                        'publishable',
                        'already-published',
                        'blocked',
                        'not-found'
                    ]
                },
                issues: { type: 'array', items: ref('ValidationIssue') },
                checks: { type: 'array', items: ref('BulkPublishCheck') }
            },
            required: ['id', 'title', 'status', 'verdict', 'issues', 'checks']
        },
        BulkPublishPreview: {
            type: 'object',
            description:
                'Dry run: one verdict per requested id, in request order.',
            properties: {
                items: { type: 'array', items: ref('BulkPublishVerdict') }
            },
            required: ['items']
        },
        BulkPublishResult: {
            type: 'object',
            description:
                'The committed publish — partial success is normal: only the valid drafts transition.',
            properties: {
                published: {
                    type: 'array',
                    items: UUID,
                    description: 'Ids actually transitioned to published.'
                },
                skipped: {
                    type: 'array',
                    description: 'Ids left untouched, with why.',
                    items: {
                        type: 'object',
                        properties: {
                            id: UUID,
                            reason: {
                                type: 'string',
                                enum: [
                                    'publishable',
                                    'already-published',
                                    'blocked',
                                    'not-found'
                                ]
                            }
                        },
                        required: ['id', 'reason']
                    }
                }
            },
            required: ['published', 'skipped']
        },
        BulkActionResult: {
            type: 'object',
            description: 'How many rows the bulk action changed.',
            properties: { count: { type: 'integer' } },
            required: ['count']
        },
        RevisionSnapshot: {
            type: 'object',
            description:
                'The captured document — the values bag plus the ordered link sets that never travel in it.',
            properties: {
                values: { type: 'object', additionalProperties: true },
                relations: {
                    type: 'object',
                    additionalProperties: { type: 'array', items: UUID }
                }
            },
            required: ['values', 'relations']
        },
        RevisionSummary: {
            type: 'object',
            description:
                'One version in an entry’s timeline, without its body.',
            properties: {
                id: UUID,
                number: {
                    type: 'integer',
                    description:
                        'Monotonic version number within the entry (1-based).'
                },
                status: {
                    type: 'string',
                    enum: Object.values(REVISION_STATUS)
                },
                isPublished: {
                    type: 'boolean',
                    description:
                        "Whether this is the entry's current live version."
                },
                isLatest: { type: 'boolean' },
                createdAt: DATE_TIME,
                publishedAt: DATE_TIME,
                authorId: UUID
            },
            required: [
                'id',
                'number',
                'status',
                'isPublished',
                'isLatest',
                'createdAt'
            ]
        },
        RevisionList: {
            type: 'object',
            description: 'The version timeline, newest first.',
            properties: {
                items: { type: 'array', items: ref('RevisionSummary') },
                total: { type: 'integer' }
            },
            required: ['items', 'total']
        },
        RevisionDetail: {
            allOf: [
                ref('RevisionSummary'),
                {
                    type: 'object',
                    properties: {
                        snapshot: ref('RevisionSnapshot'),
                        relationRefs: {
                            type: 'object',
                            additionalProperties: {
                                type: 'array',
                                items: ref('RelationRef')
                            },
                            description:
                                "Each relation field's snapshot ids resolved to display refs, capped per field."
                        },
                        relationTotals: {
                            type: 'object',
                            additionalProperties: { type: 'integer' },
                            description:
                                'True link count per relation field (may exceed the capped refs).'
                        },
                        mediaRefs: {
                            type: 'object',
                            additionalProperties: {
                                type: 'array',
                                items: ref('MediaRef')
                            }
                        }
                    },
                    required: ['snapshot']
                }
            ]
        },
        ContentTypeSummary: {
            type: 'object',
            description:
                'A content type as the wizard sees it — identity and envelope flags, no fields.',
            properties: {
                name: {
                    type: 'string',
                    description: 'Machine name (the `typeName` segment).'
                },
                kind: { type: 'string', enum: ['collection', 'single'] },
                label: { type: 'string' },
                description: { type: 'string' },
                path: {
                    type: 'string',
                    description: 'Route of a `single` page type.'
                },
                publishable: { type: 'boolean' },
                paranoid: { type: 'boolean' },
                i18n: { type: 'boolean' }
            },
            required: [
                'name',
                'kind',
                'label',
                'publishable',
                'paranoid',
                'i18n'
            ]
        },
        ContentFieldSchema: {
            type: 'object',
            description:
                'One field of a content type: its type, validation rules, and admin presentation props.',
            properties: {
                name: { type: 'string' },
                type: {
                    type: 'string',
                    description: 'Field type — `text`, `relation`, `media`, …'
                },
                required: { type: 'boolean' },
                localized: { type: 'boolean' },
                validation: { type: 'object', additionalProperties: true },
                admin: { type: 'object', additionalProperties: true },
                options: { type: 'array', items: { type: 'string' } },
                multiple: { type: 'boolean' },
                accept: {
                    type: 'object',
                    properties: {
                        kinds: { type: 'array', items: { type: 'string' } },
                        mimeTypes: { type: 'array', items: { type: 'string' } }
                    }
                },
                relation: {
                    type: 'object',
                    properties: {
                        to: { type: 'string' },
                        many: { type: 'boolean' },
                        onDelete: {
                            type: 'string',
                            enum: ['cascade', 'set null', 'restrict']
                        },
                        unique: { type: 'boolean' },
                        inverse: {
                            type: 'object',
                            properties: { field: { type: 'string' } },
                            required: ['field']
                        }
                    },
                    required: ['to', 'many']
                }
            },
            required: ['name', 'type', 'required', 'validation', 'admin']
        },
        ContentTypeSummaryList: {
            type: 'array',
            items: ref('ContentTypeSummary')
        },
        ContentTypeSchema: {
            allOf: [
                ref('ContentTypeSummary'),
                {
                    type: 'object',
                    properties: {
                        fields: {
                            type: 'array',
                            items: ref('ContentFieldSchema')
                        }
                    },
                    required: ['fields']
                }
            ]
        },
        FilterField: {
            type: 'object',
            description:
                'One filterable path the query builder may use — dotted for a relation hop (`author.name`).',
            properties: {
                path: { type: 'string' },
                label: { type: 'string' },
                type: {
                    type: 'string',
                    enum: [
                        'string',
                        'number',
                        'boolean',
                        'uuid',
                        'date',
                        'enum'
                    ]
                },
                enumValues: { type: 'array', items: { type: 'string' } },
                group: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Breadcrumb of relation labels, root-first.'
                },
                relationTarget: {
                    type: 'string',
                    description:
                        "For a relation's own `id` field: the target content type."
                }
            },
            required: ['path', 'label', 'type', 'group']
        },
        FilterFields: {
            type: 'object',
            properties: {
                fields: { type: 'array', items: ref('FilterField') }
            },
            required: ['fields']
        }
    };
}

/**
 * Every schema this plugin contributes: the shared shapes plus, for each
 * registered content type, its `Values` / `Entry` / `ListPage` trio.
 */
export function buildContentSchemas(
    types: readonly SerializedContentType[]
): Record<string, OpenApiSchema> {
    const schemas = sharedSchemas();
    for (const type of types) {
        const names = schemaNamesOf(type);
        schemas[names.values] = valuesSchema(type);
        schemas[names.entry] = entrySchema(type, names);
        schemas[names.listPage] = listPageSchema(type, names);
    }
    return schemas;
}
