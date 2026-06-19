import { collection, f } from '@ortha-cms/content-server/define';

/** Bylines shared across posts. */
export const author = collection('author', {
    label: 'Authors',
    description: 'Bylines shared across posts.',
    fields: {
        name: f.text({ required: true, maxLength: 120 }),
        role: f.text({
            admin: { placeholder: 'e.g. Senior Editor' }
        }),
        bio: f.richtext({ admin: { widget: 'textarea' } }),
        avatar: f.media(),
        joinedOn: f.date(),
        active: f.boolean({ required: true })
    }
});
