import { defineMessages, useIntl, type MessageDescriptor } from 'react-intl';
import { cn } from '@orthacms/design-system';
import type { FieldDocType } from '@orthacms/schema-builder-domain';
import { FieldTypeIcon } from '../../FieldTypeIcon';

const messages = defineMessages({
    text: { id: 'schemaBuilder.fieldType.text', defaultMessage: 'Short text' },
    richtext: {
        id: 'schemaBuilder.fieldType.richtext',
        defaultMessage: 'Rich text'
    },
    number: { id: 'schemaBuilder.fieldType.number', defaultMessage: 'Number' },
    money: { id: 'schemaBuilder.fieldType.money', defaultMessage: 'Money' },
    boolean: {
        id: 'schemaBuilder.fieldType.boolean',
        defaultMessage: 'Yes / no'
    },
    date: { id: 'schemaBuilder.fieldType.date', defaultMessage: 'Date' },
    datetime: {
        id: 'schemaBuilder.fieldType.datetime',
        defaultMessage: 'Date & time'
    },
    select: {
        id: 'schemaBuilder.fieldType.select',
        defaultMessage: 'One of a list'
    },
    multiselect: {
        id: 'schemaBuilder.fieldType.multiselect',
        defaultMessage: 'Several of a list'
    },
    json: { id: 'schemaBuilder.fieldType.json', defaultMessage: 'JSON' },
    relation: {
        id: 'schemaBuilder.fieldType.relation',
        defaultMessage: 'Relation'
    },
    media: { id: 'schemaBuilder.fieldType.media', defaultMessage: 'Media' }
});

/** A field type's name in words, for the tile and the sheet. */
export const FIELD_TYPE_LABEL: Readonly<
    Record<FieldDocType, MessageDescriptor>
> = messages;

type Props = { type: FieldDocType; selected: boolean; onSelect: () => void };

/** One field type in the dialog's grid — a radio, so the grid is one tab stop. */
export function FieldTypeTile({ type, selected, onSelect }: Props) {
    const intl = useIntl();
    return (
        <button
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={onSelect}
            className={cn(
                'flex items-center gap-2 rounded-lg border p-2 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring',
                selected
                    ? 'border-primary bg-accent font-medium'
                    : 'hover:bg-accent/60'
            )}
        >
            <FieldTypeIcon type={type} />
            <span className="min-w-0 truncate">
                {intl.formatMessage(messages[type])}
            </span>
        </button>
    );
}
