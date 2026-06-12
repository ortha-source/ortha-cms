import { collection, f } from '@ortha-cms/content-server/define';

/** Editorial tags, attached to posts many-to-many. */
export const tag = collection('tag', {
    label: 'Tags',
    fields: {
        name: f.text({
            required: true,
            maxLength: 40,
            pattern: '^[a-z0-9-]+$',
            admin: { widget: 'slug', description: 'lowercase, dashes only' }
        }),
        color: f.select({
            options: ['gray', 'green', 'blue', 'amber'] as const,
            admin: { widget: 'color' }
        })
    }
});
