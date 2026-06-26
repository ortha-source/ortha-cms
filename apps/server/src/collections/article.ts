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
            admin: {
                label: 'Text',
                description: 'A short single-line string (3–200 characters).',
                placeholder: 'e.g. Getting started with Ortha'
            }
        }),
        richtext: field.richtext({
            admin: {
                label: 'Richtext',
                widget: 'textarea',
                description: 'Long-form body copy for the article.',
                placeholder: 'Write the article body…'
            }
        }),
        number: field.number({
            integer: true,
            min: 1,
            max: 120,
            admin: {
                label: 'Number',
                description: 'A whole number between 1 and 120.',
                placeholder: 'e.g. 42'
            }
        }),
        money: field.money({
            min: 0,
            admin: {
                label: 'Money',
                description: 'An amount stored in minor units (cents).',
                placeholder: 'e.g. 1999 for $19.99'
            }
        }),
        boolean: field.boolean({
            admin: {
                label: 'Boolean',
                description: 'Toggle this article on or off.'
            }
        }),
        date: field.date({
            admin: {
                label: 'Date',
                description: 'A calendar date, no time of day.'
            }
        }),
        datetime: field.datetime({
            admin: {
                label: 'Datetime',
                description: 'A specific point in time (date and time).'
            }
        }),
        select: field.select({
            options: ['article', 'tutorial', 'changelog'] as const,
            required: true,
            admin: {
                label: 'Select',
                description: 'Pick exactly one content category.'
            }
        }),
        multiselect: field.multiselect({
            options: ['draft', 'featured', 'archived', 'pinned'] as const,
            admin: {
                label: 'Multiselect',
                description: 'Choose any number of labels for this article.'
            }
        }),
        json: field.json({
            admin: {
                label: 'Json',
                description: 'Arbitrary structured data as raw JSON.',
                placeholder: '{\n  "key": "value"\n}'
            }
        }),
    }
});
