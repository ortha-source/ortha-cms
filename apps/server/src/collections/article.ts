import {
    collection,
    f,
    type AnyContentType
} from '@ortha-cms/content-server/define';
import { landing } from '../pages/landing';

/**
 * Articles — the reference collection. Deliberately exercises **every** field
 * type in the `f.*` vocabulary (validated text, richtext, number, money,
 * boolean, date, datetime, select, json, media) plus both relation shapes: a
 * single FK to the landing page and a many-to-many self-relation. The matching
 * single is {@link landing}; together they are the host's complete demo schema.
 */
export const article = collection('article', {
    label: 'Articles',
    description: 'The reference collection — every field type, end to end.',
    fields: {
        title: f.text({
            required: true,
            minLength: 3,
            maxLength: 200
        }),
        body: f.richtext({ admin: { widget: 'textarea' } }),
        readingMinutes: f.number({ integer: true, min: 1, max: 120 }),
        price: f.money({
            min: 0,
            admin: { description: 'Sponsorship price in minor units (cents).' }
        }),
        featured: f.boolean(),
        reviewDueOn: f.date({
            admin: { description: 'Editorial freshness check-in.' }
        }),
        publishedAt: f.datetime(),
        format: f.select({
            options: ['article', 'tutorial', 'changelog'] as const,
            required: true
        }),
        extra: f.json({
            admin: { hidden: true, description: 'Escape hatch.' }
        }),
        heroImage: f.media(),
        // Single FK relation → the landing page (optional ⇒ onDelete 'set null').
        // Thunks are annotated `AnyContentType` to break the article↔landing
        // (and article→article) type-inference cycle; the value type of a
        // relation is its id(s), independent of the target.
        hero: f.relation({ to: (): AnyContentType => landing }),
        // Many-to-many self-relation — "related articles".
        related: f.relation({ to: (): AnyContentType => article, many: true })
    }
});
