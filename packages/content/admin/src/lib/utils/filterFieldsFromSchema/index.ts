import { defineMessages, type MessageDescriptor } from 'react-intl';
import {
    FIELD_TYPE,
    type FieldType,
    type FilterField,
    type FilterEnumValue
} from '@ortha-cms/query-builder-admin';
import type { ContentField, ContentTypeDetail } from '../../types/contentType';
import { CONTENT_FIELD_TYPE, ENTRY_STATUS } from '../../constants';
import { fieldLabel } from '../entryColumns';

/** Static labels for the synthetic envelope filters, co-located per convention. */
const messages = defineMessages({
    status: { id: 'content.filter.status', defaultMessage: 'Status' },
    statusDraft: {
        id: 'content.filter.status.draft',
        defaultMessage: 'Draft'
    },
    statusPublished: {
        id: 'content.filter.status.published',
        defaultMessage: 'Published'
    }
});

/** A runtime `MessageDescriptor` for a dynamic (schema-derived) label. */
function descriptor(id: string, defaultMessage: string): MessageDescriptor {
    return { id, defaultMessage };
}

/**
 * The query-builder field type for a content field, or `null` to skip it.
 * Mirrors the server's `scalarTypeFor` (`entry-filter-schema.ts`) one-for-one:
 * only fields the server's filter schema whitelists are offered, so the UI never
 * presents a filter the API would reject with a 400. `json`/`multiselect` (no
 * scalar editor) and `relation` (raw FK, no UI yet) are skipped on both sides.
 */
function fieldTypeFor(field: ContentField): FieldType | null {
    switch (field.type) {
        case CONTENT_FIELD_TYPE.Text:
        case CONTENT_FIELD_TYPE.RichText:
            return FIELD_TYPE.String;
        case CONTENT_FIELD_TYPE.Number:
        case CONTENT_FIELD_TYPE.Money:
            return FIELD_TYPE.Number;
        case CONTENT_FIELD_TYPE.Boolean:
            return FIELD_TYPE.Boolean;
        case CONTENT_FIELD_TYPE.Date:
        case CONTENT_FIELD_TYPE.Datetime:
            return FIELD_TYPE.Date;
        case CONTENT_FIELD_TYPE.Select:
            return FIELD_TYPE.Enum;
        default:
            // json / multiselect / relation have no scalar filter editor.
            return null;
    }
}

/**
 * Derive the query-builder filter surface from a content type's schema. Each
 * filterable field maps to a {@link FilterField} whose `id` is the field name,
 * with a synthetic **Status** enum prepended **only for publishable types** (a
 * non-publishable type has no publish state). `json` fields are skipped (no editor);
 * `select` fields become enums offering their declared options. Labels are
 * runtime descriptors since the field set is dynamic.
 */
export function filterFieldsFromSchema(
    schema: ContentTypeDetail
): FilterField[] {
    const status: FilterField = {
        id: 'status',
        label: messages.status,
        type: FIELD_TYPE.Enum,
        enumValues: [
            { value: ENTRY_STATUS.Draft, label: messages.statusDraft },
            { value: ENTRY_STATUS.Published, label: messages.statusPublished }
        ]
    };

    const fields = schema.fields.flatMap((field): FilterField[] => {
        const type = fieldTypeFor(field);
        if (!type) return [];
        const label = descriptor(
            `content.filter.${schema.name}.${field.name}`,
            fieldLabel(field)
        );
        if (type === FIELD_TYPE.Enum) {
            const enumValues: FilterEnumValue[] = (field.options ?? []).map(
                (option) => ({
                    value: option,
                    label: descriptor(
                        `content.filter.${schema.name}.${field.name}.${option}`,
                        option
                    )
                })
            );
            return [{ id: field.name, label, type, enumValues }];
        }
        return [{ id: field.name, label, type }];
    });

    // The synthetic Status filter only applies to publishable types.
    return schema.publishable ? [status, ...fields] : fields;
}
