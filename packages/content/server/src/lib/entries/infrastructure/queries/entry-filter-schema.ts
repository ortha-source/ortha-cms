import {
    ScalarFieldType,
    type FieldSchema,
    type FilterSchema,
    type ScalarFieldSchema
} from '@ortha-cms/utils-server';
import { ENTRY_STATUS, type AnyContentType } from '../../../types/content-type';
import { CONTENT_FIELD_TYPE, type AnyFieldSpec } from '../../../types/fields';

/**
 * The filter scalar type for one content field, or `null` to leave it
 * unfilterable. Mirrors the admin's `filterFieldsFromSchema`: text-like fields
 * filter as strings, `select` as an enum of its options, numerics as numbers,
 * dates as dates. `json`/`multiselect` have no scalar editor, and `relation`
 * filtering (by raw FK uuid) has no UI yet — all skipped.
 */
function scalarTypeFor(spec: AnyFieldSpec): ScalarFieldSchema | null {
    switch (spec.type) {
        case CONTENT_FIELD_TYPE.Text:
        case CONTENT_FIELD_TYPE.RichText:
            return { type: ScalarFieldType.String };
        case CONTENT_FIELD_TYPE.Select:
            return {
                type: ScalarFieldType.Enum,
                enumValues: spec.options ?? []
            };
        case CONTENT_FIELD_TYPE.Number:
        case CONTENT_FIELD_TYPE.Money:
            return { type: ScalarFieldType.Number };
        case CONTENT_FIELD_TYPE.Boolean:
            return { type: ScalarFieldType.Boolean };
        case CONTENT_FIELD_TYPE.Date:
        case CONTENT_FIELD_TYPE.Datetime:
            return { type: ScalarFieldType.Date };
        default:
            // json / multiselect / relation
            return null;
    }
}

/**
 * Whether a field is backed by a comparable scalar column — the single source of
 * truth for "can this field be filtered or sorted". `json`/`multiselect` (jsonb)
 * and `relation` (FK uuid / join table) are not: they have no scalar editor and
 * ordering them is meaningless. The sort whitelist and the filter schema both
 * derive from this, so the two can't drift apart.
 */
export function isScalarField(spec: AnyFieldSpec): boolean {
    return scalarTypeFor(spec) !== null;
}

/**
 * Build the query-builder `FilterSchema` for one content type at request time.
 * Whitelists the always-present envelope columns (`createdAt`/`updatedAt`),
 * plus `status`/`publishedAt` only on publishable types, plus `locale` on i18n
 * types, plus every filterable field (those `isScalarField` admits — the same
 * set the admin's `filterFieldsFromSchema` offers), keyed by the property
 * names the engine resolves to table columns. (`status` has a matching admin
 * filter; the timestamp envelopes like `publishedAt` are filterable via the
 * API but have no UI control yet.) This is the security boundary: only listed
 * fields/ops reach SQL, and the engine's depth/node caps bound payload
 * blow-up.
 *
 * `extensionFields` are **virtual** fields contributed by the bound
 * `CONTENT_ENTRY_EXTENSION` (e.g. locale aggregates): their declarations merge
 * into `fields` (so the parser can coerce values) and their names are
 * registered on the schema's `extensionFields` set, routing them to the
 * extension's own SQL resolver instead of a table column. A field column
 * always wins a name collision — an extension cannot shadow real data.
 */
export function buildEntryFilterSchema(
    type: AnyContentType,
    extensionFields?: FieldSchema
): FilterSchema {
    const fields: FieldSchema = {
        createdAt: { type: ScalarFieldType.Date },
        updatedAt: { type: ScalarFieldType.Date }
    };

    // Publish state is filterable only where the column exists.
    if (type.publishable) {
        fields['status'] = {
            type: ScalarFieldType.Enum,
            enumValues: [ENTRY_STATUS.Draft, ENTRY_STATUS.Published]
        };
        fields['publishedAt'] = { type: ScalarFieldType.Date };
    }
    // The locale column is filterable only where it exists. Its allowed values
    // are the extension's business — a plain string here; the extension's
    // listScope validates slugs on the dedicated `?locale=` path.
    if (type.i18n) {
        fields['locale'] = { type: ScalarFieldType.String };
    }

    for (const [name, spec] of Object.entries(type.fields)) {
        const scalar = scalarTypeFor(spec);
        if (scalar) fields[name] = scalar;
    }

    if (!extensionFields) return { fields };

    const extensionNames = Object.keys(extensionFields).filter(
        (name) => !(name in fields)
    );
    for (const name of extensionNames) {
        fields[name] = extensionFields[name];
    }
    return { fields, extensionFields: new Set(extensionNames) };
}
