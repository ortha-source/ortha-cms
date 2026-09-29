import type { MessageDescriptor } from 'react-intl';
import {
    FIELD_TYPE,
    type FieldType,
    type FilterField
} from '@orthacms/query-builder-admin';
import type {
    ContentType,
    ContentTypeAccess,
    ContentTypeAccessResponse,
    ContentTypeSummaryResponse,
    EntryRecord,
    EntryUsage,
    FilterFieldType,
    RelationFieldView,
    RelationRef,
    WireFilterField
} from '../../domain/types/contentType';

/**
 * The content plugin's anti-corruption layer: maps the wire shapes served by the
 * content API to the admin's models. Content's wire and view shapes are largely
 * congruent (fields pass through untouched), so this is deliberately thin — one
 * summary mapper — but it keeps the seam explicit and in one place.
 */

/**
 * Normalizes a type's `access`. Absent (a server predating per-source grants)
 * reads as own and nothing shared — the only thing such a server can mean; a
 * present object missing `own` reads as not own, since a server that sends
 * `access` at all is saying what it knows. Display-only: nothing writes
 * `access` back, so neither fallback can overwrite a real value.
 */
export function toContentTypeAccess(
    wire: ContentTypeAccessResponse | undefined
): ContentTypeAccess {
    if (!wire) return { own: true, sharedSources: [] };
    return {
        own: wire.own === true,
        sharedSources: (wire.sharedSources ?? []).map((source) => ({
            workspaceId: source.workspaceId,
            workspaceName: source.workspaceName
        }))
    };
}

/** Maps one wire type summary to the admin `ContentType` model. */
export function toContentType(
    summary: ContentTypeSummaryResponse
): ContentType {
    return {
        name: summary.name,
        kind: summary.kind,
        label: summary.label,
        description: summary.description,
        path: summary.path,
        publishable: summary.publishable,
        paranoid: summary.paranoid,
        access: toContentTypeAccess(summary.access)
    };
}

/** Wire coercion type → the query-builder's UI field type (identity map). */
const FIELD_TYPE_BY_WIRE: Record<FilterFieldType, FieldType> = {
    string: FIELD_TYPE.String,
    number: FIELD_TYPE.Number,
    boolean: FIELD_TYPE.Boolean,
    uuid: FIELD_TYPE.Uuid,
    date: FIELD_TYPE.Date,
    enum: FIELD_TYPE.Enum
};

/** A runtime `MessageDescriptor` for a dynamic (schema-derived) label. */
function descriptor(id: string, defaultMessage: string): MessageDescriptor {
    return { id, defaultMessage };
}

/**
 * Maps one server-derived filterable path to the query-builder's `FilterField`.
 * Labels are runtime descriptors (the field set is dynamic), namespaced by the
 * root type and the dotted path so they stay stable; the server's plain-string
 * labels become each descriptor's `defaultMessage`. Replaces the old
 * hand-mirrored `filterFieldsFromSchema` — the surface is now built once, on the
 * server, so the picker and the SQL whitelist can't drift.
 */
export function toFilterField(
    typeName: string,
    wire: WireFilterField
): FilterField {
    const base = `content.filter.${typeName}.${wire.path}`;
    const field: FilterField = {
        id: wire.path,
        label: descriptor(base, wire.label),
        type: FIELD_TYPE_BY_WIRE[wire.type]
    };
    if (wire.group.length > 0) {
        field.group = wire.group.map((crumb, i) =>
            descriptor(`${base}.group.${i}`, crumb)
        );
    }
    if (wire.enumValues) {
        field.enumValues = wire.enumValues.map((value) => ({
            value,
            label: descriptor(`${base}.${value}`, value)
        }));
    }
    if (wire.relationTarget) field.relationTarget = wire.relationTarget;
    return field;
}

/**
 * Normalizes one entry off the wire: `source` and `readOnly` arrived with
 * shared workspaces, so a server that predates them sends neither — and
 * "absent" can only mean the record is this workspace's own and writable.
 * Neither field is ever sent back on a save (the write body is built from
 * `values`), so these fallbacks can't be written over a real value.
 *
 * An absent `readOnly` is derived from `source`, not defaulted to `false`: the
 * records list reports `source` but not `readOnly`, and the editor seeds from
 * that list's cache when a row is opened from the table. Defaulting there
 * made a foreign row look writable — the editor offered Save, and the server
 * refused it. A record with a source is foreign, and foreign is read-only.
 */
export function toEntryRecord(wire: EntryRecord): EntryRecord {
    const source = wire.source ?? null;
    return {
        ...wire,
        source,
        readOnly: wire.readOnly ?? source !== null
    };
}

/** Normalizes one relation ref's `source` (absent ≡ the open workspace's own). */
export function toRelationRef(wire: RelationRef): RelationRef {
    return { ...wire, source: wire.source ?? null };
}

/** Normalizes every ref in one relation field's page. */
export function toRelationFieldView(
    wire: RelationFieldView
): RelationFieldView {
    return { ...wire, items: wire.items.map(toRelationRef) };
}

/**
 * Normalizes one usages row. Defensive about `count` too: a row the server
 * sends at all is at least one link, and a non-number would print as `NaN`.
 */
export function toEntryUsage(wire: EntryUsage): EntryUsage {
    return {
        workspaceId: wire.workspaceId,
        workspaceName: wire.workspaceName,
        count: typeof wire.count === 'number' ? wire.count : 0
    };
}
