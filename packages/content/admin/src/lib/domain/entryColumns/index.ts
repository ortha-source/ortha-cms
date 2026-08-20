import type { ContentField, ContentTypeDetail } from '../types/contentType';
import type { RecordsColumnItem } from '../../presentation/slots/contentSlots';
import { COLUMN_KIND, CONTENT_FIELD_TYPE, ENVELOPE_COLUMN } from '../constants';

/** One selectable table column: a schema field, an envelope column, or a slot-contributed extension column. */
export type EntryColumn =
    | { id: string; kind: typeof COLUMN_KIND.Field; field: ContentField }
    | { id: typeof ENVELOPE_COLUMN.Status; kind: typeof COLUMN_KIND.Status }
    | {
          id: typeof ENVELOPE_COLUMN.UpdatedAt;
          kind: typeof COLUMN_KIND.Updated;
      }
    | {
          id: string;
          kind: typeof COLUMN_KIND.Extension;
          item: RecordsColumnItem;
      };

/** Title-cases a machine field name for a fallback label (`postedAt` → `Posted At`). */
function humanize(name: string): string {
    return name
        .replace(/[_-]+/g, ' ')
        .replace(/([a-z\d])([A-Z])/g, '$1 $2')
        .replace(/^\w/, (c) => c.toUpperCase());
}

/** The display label for a field — its admin label, else a humanized name. */
export function fieldLabel(field: ContentField): string {
    const admin = field.admin.label;
    return typeof admin === 'string' && admin.length > 0
        ? admin
        : humanize(field.name);
}

/** Field types that render poorly in a cell, so they're off by default. */
const HEAVY_TYPES = new Set<string>([
    CONTENT_FIELD_TYPE.RichText,
    CONTENT_FIELD_TYPE.Json,
    // Media stores raw asset ids in the values bag — a uuid (or array) is not a
    // useful cell, and there's no per-page media resolver on the list, so keep
    // media columns off by default (the user can still opt one in).
    CONTENT_FIELD_TYPE.Media
]);

/** How many schema fields to show by default before the user opts into more. */
const DEFAULT_FIELD_COLUMNS = 4;

/**
 * The available columns for a collection's table and the smart default
 * selection. Available columns = every schema field (in declaration order)
 * plus the **Status** and **Updated** envelope columns, plus any applicable
 * slot-contributed extension columns (offered in the picker, hidden by
 * default). The default shows the first few non-heavy fields (excluding
 * richtext/json, which don't fit a cell) plus Status and Updated — the user
 * widens this via the column picker; {@link useEntryColumns} holds the choice
 * in component state for the session (it is **not** persisted and resets on
 * reload).
 */
export function entryColumns(
    schema: ContentTypeDetail,
    extensionItems: readonly RecordsColumnItem[] = []
): {
    columns: EntryColumn[];
    defaults: string[];
} {
    const fieldColumns: EntryColumn[] = schema.fields.map((field) => ({
        id: field.name,
        kind: COLUMN_KIND.Field,
        field
    }));
    // Status is a publish-state column — offer it only for publishable types.
    const statusColumn: EntryColumn[] = schema.publishable
        ? [{ id: ENVELOPE_COLUMN.Status, kind: COLUMN_KIND.Status }]
        : [];
    // A field column wins an id collision — an extension can't shadow data.
    const fieldIds = new Set(fieldColumns.map((column) => column.id));
    const extensionColumns: EntryColumn[] = extensionItems
        .filter((item) => item.appliesTo(schema) && !fieldIds.has(item.id))
        .map((item) => ({
            id: item.id,
            kind: COLUMN_KIND.Extension,
            item
        }));
    const columns: EntryColumn[] = [
        ...fieldColumns,
        ...statusColumn,
        ...extensionColumns,
        { id: ENVELOPE_COLUMN.UpdatedAt, kind: COLUMN_KIND.Updated }
    ];

    const defaultFields = schema.fields
        .filter((field) => !HEAVY_TYPES.has(field.type))
        .slice(0, DEFAULT_FIELD_COLUMNS)
        .map((field) => field.name);

    return {
        columns,
        defaults: [
            ...defaultFields,
            ...(schema.publishable ? [ENVELOPE_COLUMN.Status] : []),
            ENVELOPE_COLUMN.UpdatedAt
        ]
    };
}
