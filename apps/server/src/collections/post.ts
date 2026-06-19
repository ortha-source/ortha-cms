import { collection, f } from '@ortha-cms/content-server/define';
import { author } from './author';
import { tag } from './tag';

/**
 * Blog posts — the reference collection. Exercises most of the field
 * vocabulary: validated text, AI-draftable summary, two independent
 * dates, money, a single FK relation, and a many-to-many relation.
 */
export const post = collection('post', {
    label: 'Blog posts',
    description: 'Articles for the marketing blog.',
    fields: {
        title: f.text({
            required: true,
            minLength: 3,
            maxLength: 200
        }),
        summary: f.text({
            ai: true,
            maxLength: 300,
            admin: {
                widget: 'textarea',
                description: 'Shown in cards and meta tags.'
            }
        }),
        body: f.richtext(),
        author: f.relation({
            to: () => author,
            required: true,
            onDelete: 'restrict'
        }),
        tags: f.relation({ to: () => tag, many: true }),
        heroImage: f.media(),
        publishedAt: f.datetime(),
        reviewDueOn: f.date({
            admin: { description: 'Editorial freshness check-in.' }
        }),
        sponsorshipPrice: f.money({
            min: 0,
            admin: { description: 'Minor units (cents).' }
        }),
        readingMinutes: f.number({ integer: true, min: 1, max: 120 }),
        featured: f.boolean(),
        format: f.select({
            options: ['article', 'tutorial', 'changelog'] as const,
            required: true
        }),
        extra: f.json({
            admin: { hidden: true, description: 'Escape hatch.' }
        })
    }
});
