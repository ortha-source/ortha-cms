import {
    field,
    single,
} from '@ortha-cms/content-server/define';

/**
 * The site landing page — a single (one entry, routed at `/`). Mirrors
 * {@link article}'s field coverage: every scalar field type, each named and
 * labelled after its type. No relations for now.
 */
export const landing = single('landing', {
    label: 'Landing',
    description: 'The site landing page — every field type, end to end.',
    path: '/',
    publishable: true,
    fields: {
        text: field.text({
            required: true,
            minLength: 3,
            maxLength: 120,
            admin: { label: 'Text' }
        }),
        richtext: field.richtext({ admin: { label: 'Richtext' } }),
        number: field.number({ integer: true, min: 0, admin: { label: 'Number' } }),
        money: field.money({ min: 0, admin: { label: 'Money' } }),
        boolean: field.boolean({ required: true, admin: { label: 'Boolean' } }),
        date: field.date({ admin: { label: 'Date' } }),
        datetime: field.datetime({ admin: { label: 'Datetime' } }),
        select: field.select({
            options: ['light', 'dark', 'auto'] as const,
            admin: { label: 'Select' }
        }),
        multiselect: field.multiselect({
            options: ['hero', 'newsletter', 'banner', 'footer'] as const,
            admin: { label: 'Multiselect' }
        }),
        json: field.json({ admin: { label: 'Json' } }),
    }
});
