/**
 * drizzle-kit entry for the HOST-owned content tables (see
 * `../../drizzle.config.ts`). Every physical table a collection
 * generates — including many-relation join tables — must be re-exported
 * here as a top-level export, or drizzle-kit won't diff it.
 */

import { joinTableOf } from '@ortha-cms/content-server/define';
import { author } from './author';
import { home } from './home';
import { post } from './post';
import { tag } from './tag';

export const authors = author.table;
export const tags = tag.table;
export const posts = post.table;
/** post.tags many-to-many join. */
export const postTags = joinTableOf(post, 'tags');
export const homePage = home.table;
/** home.featuredPosts many-to-many join. */
export const homeFeaturedPosts = joinTableOf(home, 'featuredPosts');
