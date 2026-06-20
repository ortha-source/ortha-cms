import { defineMessages, type MessageDescriptor } from 'react-intl';
import {
    FIELD_TYPE,
    type FieldType,
    type FilterField,
    type FilterEnumValue
} from '@ortha-cms/query-builder-admin';
import type { ContentField, ContentTypeDetail } from '../../types/contentType';
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

/** The query-builder field type for a content field, or `null` to skip it. */
function fieldTypeFor(field: ContentField): FieldType | null {
    switch (field.type) {
        case 'text':
        case 'richtext':
        case 'relation':
        case 'media':
            return FIELD_TYPE.String;
        case 'number':
        case 'money':
            return FIELD_TYPE.Number;
        case 'boolean':
            return FIELD_TYPE.Boolean;
        case 'date':
        case 'datetime':
            return FIELD_TYPE.Date;
        case 'select':
            return FIELD_TYPE.Enum;
        default:
            // `json` (and any future opaque type) has no sensible filter editor.
            return null;
    }
}

/**
 * Derive the query-builder filter surface from a content type's schema. Each
 * filterable field maps to a {@link FilterField} whose `id` is the field name
 * (what {@link applyFilterTree} reads off a record), with a synthetic **Status**
 * enum prepended for the envelope column. `json` fields are skipped (no editor);
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
            { value: 'draft', label: messages.statusDraft },
            { value: 'published', label: messages.statusPublished }
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

    return [status, ...fields];
}
