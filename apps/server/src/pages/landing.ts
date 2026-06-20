import {
    f,
    single,
    type AnyContentType
} from '@ortha-cms/content-server/define';
import { article } from '../collections/article';

/**
 * The site landing page — a single (one entry, routed at `/`). Mirrors
 * {@link article}'s full field coverage so the demo page exercises every field
 * type too, with a single FK to a featured article and a many-to-many list of
 * picks. Uses lazy `to: () => article` thunks so the page and the collection can
 * import each other.
 */
export const landing = single('landing', {
    label: 'Landing',
    description: 'The site landing page — every field type, end to end.',
    path: '/',
    fields: {
        headline: f.text({ required: true, minLength: 3, maxLength: 120 }),
        intro: f.richtext(),
        heroRank: f.number({ integer: true, min: 0 }),
        budget: f.money({ min: 0 }),
        live: f.boolean({ required: true }),
        launchOn: f.date(),
        publishAt: f.datetime(),
        theme: f.select({
            options: ['light', 'dark', 'auto'] as const,
            admin: { widget: 'color' }
        }),
        meta: f.json({ admin: { hidden: true } }),
        ogImage: f.media(),
        // Single FK relation → the featured article (optional). Thunks are
        // annotated `AnyContentType` to break the landing↔article inference
        // cycle (a relation's value type is its id(s), not the target's shape).
        feature: f.relation({ to: (): AnyContentType => article }),
        // Many-to-many relation → curated article picks.
        picks: f.relation({ to: (): AnyContentType => article, many: true })
    }
});
