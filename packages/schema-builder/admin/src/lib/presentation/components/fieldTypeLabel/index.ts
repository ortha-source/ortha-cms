import { defineMessages, type MessageDescriptor } from 'react-intl';
import type { FieldDocType } from '@orthacms/schema-builder-domain';

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
