import {
    field,
    single,
} from '@ortha-cms/content-server/define';

/**
 * The site landing page — a single (one entry, routed at `/`). Mirrors
 * {@link article}'s field coverage: every scalar field type, each named and
 * labelled after its type. No relations for now.
 *
 * Intentionally **not** `publishable` (and not `paranoid`): a singleton config
 * page is always live, with no draft/published workflow — so it exercises the
 * no-`status` path (no status column, filter, or sort) end to end.
 */
export const landing = single('landing', {
    label: 'Landing',
    description: 'The site landing page — every field type, end to end.',
    path: '/',
    fields: {
        text: field.text({
            required: true,
            minLength: 3,
            maxLength: 120,
            admin: {
                label: 'Text',
                description: 'The landing page headline (3–120 characters).',
                placeholder: 'e.g. Welcome to Ortha'
            }
        }),
        richtext: field.richtext({
            admin: {
                label: 'Richtext',
                description: 'Intro copy shown beneath the headline.',
                placeholder: 'Write the landing intro…'
            }
        }),
        number: field.number({
            integer: true,
            min: 0,
            admin: {
                label: 'Number',
                description: 'A non-negative whole number.',
                placeholder: 'e.g. 3'
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
            required: true,
            admin: {
                label: 'Boolean',
                description: 'Toggle this section on or off.'
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
            options: ['light', 'dark', 'auto'] as const,
            admin: {
                label: 'Select',
                description: 'Pick the default color theme.'
            }
        }),
        multiselect: field.multiselect({
            options: ['hero', 'newsletter', 'banner', 'footer'] as const,
            admin: {
                label: 'Multiselect',
                description: 'Choose which sections to render.'
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
