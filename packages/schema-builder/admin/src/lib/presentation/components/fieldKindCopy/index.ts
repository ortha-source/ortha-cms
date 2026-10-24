import { defineMessages, type MessageDescriptor } from 'react-intl';

const messages = defineMessages({
    text: { id: 'schemaBuilder.kind.text', defaultMessage: 'Short text' },
    textHint: {
        id: 'schemaBuilder.kind.textHint',
        defaultMessage: 'One line: a title, a name, a slug.'
    },
    longtext: {
        id: 'schemaBuilder.kind.longtext',
        defaultMessage: 'Long text'
    },
    longtextHint: {
        id: 'schemaBuilder.kind.longtextHint',
        defaultMessage: 'A plain box of text, no formatting: a summary, a note.'
    },
    richtext: {
        id: 'schemaBuilder.kind.richtext',
        defaultMessage: 'Rich text'
    },
    richtextHint: {
        id: 'schemaBuilder.kind.richtextHint',
        defaultMessage: 'Formatted text with headings, lists and links: a body.'
    },
    number: { id: 'schemaBuilder.kind.number', defaultMessage: 'Number' },
    numberHint: {
        id: 'schemaBuilder.kind.numberHint',
        defaultMessage: 'A count, a rating, a position.'
    },
    money: { id: 'schemaBuilder.kind.money', defaultMessage: 'Money' },
    moneyHint: {
        id: 'schemaBuilder.kind.moneyHint',
        defaultMessage: 'An exact amount: a price, a fee.'
    },
    boolean: { id: 'schemaBuilder.kind.boolean', defaultMessage: 'Yes / no' },
    booleanHint: {
        id: 'schemaBuilder.kind.booleanHint',
        defaultMessage: 'A switch: featured, archived.'
    },
    date: { id: 'schemaBuilder.kind.date', defaultMessage: 'Date' },
    dateHint: {
        id: 'schemaBuilder.kind.dateHint',
        defaultMessage: 'A day, without a time.'
    },
    datetime: {
        id: 'schemaBuilder.kind.datetime',
        defaultMessage: 'Date & time'
    },
    datetimeHint: {
        id: 'schemaBuilder.kind.datetimeHint',
        defaultMessage: 'A moment: starts at, happened at.'
    },
    select: {
        id: 'schemaBuilder.kind.select',
        defaultMessage: 'One of a list'
    },
    selectHint: {
        id: 'schemaBuilder.kind.selectHint',
        defaultMessage: 'Pick one option you define.'
    },
    multiselect: {
        id: 'schemaBuilder.kind.multiselect',
        defaultMessage: 'Several of a list'
    },
    multiselectHint: {
        id: 'schemaBuilder.kind.multiselectHint',
        defaultMessage: 'Pick any number of options you define.'
    },
    json: { id: 'schemaBuilder.kind.json', defaultMessage: 'JSON' },
    jsonHint: {
        id: 'schemaBuilder.kind.jsonHint',
        defaultMessage:
            'Structured data, edited as a large box of text — like an article’s Metadata.'
    },
    relation: { id: 'schemaBuilder.kind.relation', defaultMessage: 'Relation' },
    relationHint: {
        id: 'schemaBuilder.kind.relationHint',
        defaultMessage: 'A link to entries of another type.'
    },
    media: { id: 'schemaBuilder.kind.media', defaultMessage: 'Media' },
    mediaHint: {
        id: 'schemaBuilder.kind.mediaHint',
        defaultMessage: 'Files from the media library: an image, a PDF.'
    },
    textExample: {
        id: 'schemaBuilder.kind.textExample',
        defaultMessage: 'A title, a name, a slug'
    },
    longtextExample: {
        id: 'schemaBuilder.kind.longtextExample',
        defaultMessage: 'A summary, a note'
    },
    richtextExample: {
        id: 'schemaBuilder.kind.richtextExample',
        defaultMessage: 'Headings, lists, links'
    },
    numberExample: {
        id: 'schemaBuilder.kind.numberExample',
        defaultMessage: 'A count, a rating'
    },
    moneyExample: {
        id: 'schemaBuilder.kind.moneyExample',
        defaultMessage: 'A price, a fee'
    },
    booleanExample: {
        id: 'schemaBuilder.kind.booleanExample',
        defaultMessage: 'Featured, archived'
    },
    dateExample: {
        id: 'schemaBuilder.kind.dateExample',
        defaultMessage: 'A day'
    },
    datetimeExample: {
        id: 'schemaBuilder.kind.datetimeExample',
        defaultMessage: 'A moment'
    },
    selectExample: {
        id: 'schemaBuilder.kind.selectExample',
        defaultMessage: 'A category, a status'
    },
    multiselectExample: {
        id: 'schemaBuilder.kind.multiselectExample',
        defaultMessage: 'Tags you define'
    },
    jsonExample: {
        id: 'schemaBuilder.kind.jsonExample',
        defaultMessage: 'Structured data, metadata'
    },
    relationExample: {
        id: 'schemaBuilder.kind.relationExample',
        defaultMessage: 'Entries of another type'
    },
    mediaExample: {
        id: 'schemaBuilder.kind.mediaExample',
        defaultMessage: 'Images, video, PDFs'
    }
});

/**
 * What each kind of field (a catalog id) is called, what it is for, and a
 * short example of what it holds — the line under it in the kind picker.
 */
export const kindCopy = (
    id: string
): {
    label: MessageDescriptor;
    hint: MessageDescriptor;
    example: MessageDescriptor;
} => {
    const table = messages as Record<string, MessageDescriptor>;
    return {
        label: table[id] ?? messages.text,
        hint: table[`${id}Hint`] ?? messages.textHint,
        example: table[`${id}Example`] ?? messages.textExample
    };
};
