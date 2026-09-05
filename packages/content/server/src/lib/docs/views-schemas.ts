/**
 * The OpenAPI schemas the **saved views** plugin contributes.
 *
 * `SavedView` is a plain TypeScript `interface` in `views/domain/`, which the
 * swagger scanner cannot see and ADR-0003 forbids decorating — so the shape is
 * written out here instead, the same way the content types are.
 *
 * One thing about it is runtime data rather than a fixed contract: `scope` is
 * `content:<typeName>`, and which type names exist is what the host registered.
 * {@link buildViewsSchemas} therefore takes the serialized registry and turns
 * the scope into an enum of the real lists, so a reader of the reference sees
 * `content:article`, not "some string".
 */

import type { SerializedContentType } from '../registry/content-type-registry';
import type { OpenApiSchema } from './field-schema';
import { ref } from './content-schemas';
import {
    VIEW_VISIBILITY_VALUES,
    type SavedView
} from '../views/domain/saved-view';
import {
    CONTENT_SCOPE_PREFIX,
    VIEW_COLUMN_MAX_LENGTH,
    VIEW_MAX_COLUMNS,
    VIEW_NAME_MAX_LENGTH,
    VIEW_SCOPE_MAX_LENGTH
} from '../views/views.constants';
import { FILTER_MAX_LENGTH, MAX_PAGE_SIZE } from '../entries/entries.constants';

/** Schema name of one saved view. */
export const SAVED_VIEW_SCHEMA = 'SavedView';
/** Schema name of the slice a view restores. */
export const SAVED_VIEW_PAYLOAD_SCHEMA = 'SavedViewPayload';

/**
 * The `scope` values the API will accept and return.
 *
 * An enum when the host registered types, a plain bounded string when it
 * registered none — an empty `enum` would be a schema nothing can satisfy, and
 * "no views are reachable" is better said by the absence of types than by a
 * response schema that rejects every answer.
 */
function scopeSchema(types: readonly SerializedContentType[]): OpenApiSchema {
    const base = {
        type: 'string',
        maxLength: VIEW_SCOPE_MAX_LENGTH,
        description: `The list this view belongs to, as \`${CONTENT_SCOPE_PREFIX}<typeName>\`. A scope naming a type this workspace was not granted is a 404 — the same answer an unknown type gives, so the endpoint cannot be used to discover which types exist elsewhere.`
    };
    if (types.length === 0) {
        return base;
    }
    return {
        ...base,
        enum: types.map((type) => `${CONTENT_SCOPE_PREFIX}${type.name}`)
    };
}

/**
 * The stored slice.
 *
 * `filter` and `sort` are the records page's own `?filter=` / `?sort=` strings
 * carried verbatim, so this describes them as the strings they are rather than
 * re-modelling a filter tree that would then have two spellings. `search` and
 * `page` are absent by design — see {@link SavedViewPayload}.
 */
function payloadSchema(): OpenApiSchema {
    return {
        type: 'object',
        title: 'Saved view payload',
        description:
            'The filter/sort/columns/page-size slice a view restores. Mirrors the records page’s URL params, so a saved view and a hand-edited link replay through one code path. A one-off `search` and the reading position `page` are deliberately not part of a view.',
        properties: {
            filter: {
                type: 'string',
                maxLength: FILTER_MAX_LENGTH,
                description:
                    'The filter tree as a JSON string, byte-identical to `?filter=`. Stored opaquely and re-validated against the type when replayed.'
            },
            sort: {
                type: 'string',
                maxLength: 255,
                description:
                    'Sort spec: a column id (ascending) or `-`-prefixed (descending).'
            },
            pageSize: {
                type: 'integer',
                minimum: 1,
                maximum: MAX_PAGE_SIZE,
                description: 'Rows per page this view opens with.'
            },
            columns: {
                type: 'array',
                maxItems: VIEW_MAX_COLUMNS,
                items: { type: 'string', maxLength: VIEW_COLUMN_MAX_LENGTH },
                description:
                    'Visible column ids **in display order**. Ids the type no longer has are dropped when the view is applied.'
            },
            extra: {
                type: 'object',
                additionalProperties: { type: 'string' },
                description:
                    'Slot-contributed list params (the i18n plugin’s `locale`, and whatever a later plugin adds), as a flat string map. Opaque on purpose — the keys come from plugin-registered toolbar items at runtime.'
            }
        },
        // Every field is optional: a view over an unfiltered, unsorted,
        // default-column list stores `{}`, and that is a legitimate view.
        additionalProperties: false
    };
}

/** One saved view, as every one of these routes answers it. */
function savedViewSchema(
    types: readonly SerializedContentType[]
): OpenApiSchema {
    const properties: Record<keyof SavedView, OpenApiSchema> = {
        id: { type: 'string', format: 'uuid', description: 'View id.' },
        scope: scopeSchema(types),
        name: {
            type: 'string',
            minLength: 1,
            maxLength: VIEW_NAME_MAX_LENGTH,
            description:
                'Display name. Unique per person within one workspace and scope.'
        },
        visibility: {
            type: 'string',
            enum: [...VIEW_VISIBILITY_VALUES],
            description:
                '`private` (only its owner) or `workspace` (every member). Sharing needs `views:share`.'
        },
        ownerId: {
            type: 'string',
            format: 'uuid',
            description: 'The user who created it.'
        },
        isOwn: {
            type: 'boolean',
            description:
                'Whether the **caller** owns it. Computed per request, so the same row answers differently to two people — the admin gates Save and Delete on it.'
        },
        isDefault: {
            type: 'boolean',
            description:
                'Whether it is the caller’s default for this scope. Also per-caller: a default is a personal landing choice, not a property of the view.'
        },
        payload: ref(SAVED_VIEW_PAYLOAD_SCHEMA),
        updatedAt: {
            type: 'string',
            format: 'date-time',
            description: 'Last modified, ISO-8601.'
        }
    };

    return {
        type: 'object',
        title: 'Saved view',
        description:
            'A named slice of one content list. The stored payload is **not** a grant: it is replayed through the ordinary list query with the reader’s own permissions, workspace scope and content grants, so a shared view shows a narrower reader fewer rows — never more.',
        properties,
        required: [
            'id',
            'scope',
            'name',
            'visibility',
            'ownerId',
            'isOwn',
            'isDefault',
            'payload',
            'updatedAt'
        ],
        additionalProperties: false
    };
}

/** The saved-view schemas, keyed by schema name. */
export function buildViewsSchemas(
    types: readonly SerializedContentType[]
): Record<string, OpenApiSchema> {
    return {
        [SAVED_VIEW_PAYLOAD_SCHEMA]: payloadSchema(),
        [SAVED_VIEW_SCHEMA]: savedViewSchema(types)
    };
}
