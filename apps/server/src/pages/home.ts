import { f, single } from '@ortha-cms/content-server/define';
import { post } from '../collections/post';

/** The site landing page — a single (one entry, routed at `/`). */
export const home = single('home', {
    label: 'Home',
    description: 'The site landing page.',
    path: '/',
    fields: {
        headline: f.text({ required: true, maxLength: 120, localized: true }),
        intro: f.richtext({ localized: true }),
        featuredPosts: f.relation({ to: () => post, many: true })
    }
});
