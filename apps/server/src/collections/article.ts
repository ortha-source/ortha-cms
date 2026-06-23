import {
    collection,
    field,
} from '@ortha-cms/content-server/define';

/**
 * Articles — the reference collection. Exercises **every** scalar field type in
 * the `field.*` vocabulary, with each field named and labelled after its type so
 * the admin records table shows one column per field type. No relations for now.
 */
export const article = collection('article', {
    label: 'Articles',
    description: 'The reference collection — every field type, end to end.',
    publishable: true,
    paranoid: true,
    fields: {
        text: field.text({
            required: true,
            minLength: 3,
            maxLength: 200,
            admin: { label: 'Text' }
        }),
        richtext: field.richtext({
            admin: { label: 'Richtext', widget: 'textarea' }
        }),
        number: field.number({
            integer: true,
            min: 1,
            max: 120,
            admin: { label: 'Number' }
        }),
        money: field.money({
            min: 0,
            admin: { label: 'Money', description: 'Stored in minor units (cents).' }
        }),
        boolean: field.boolean({ admin: { label: 'Boolean' } }),
        date: field.date({ admin: { label: 'Date' } }),
        datetime: field.datetime({ admin: { label: 'Datetime' } }),
        select: field.select({
            options: ['article', 'tutorial', 'changelog'] as const,
            required: true,
            admin: { label: 'Select' }
        }),
        multiselect: field.multiselect({
            options: ['draft', 'featured', 'archived', 'pinned'] as const,
            admin: { label: 'Multiselect' }
        }),
        json: field.json({ admin: { label: 'Json' } }),
    }
});
