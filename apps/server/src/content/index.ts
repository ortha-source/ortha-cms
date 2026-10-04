// @orthacms-generated — the content manifest. Do not edit by hand.
//
// Regenerate it with `orthacms content sync` (in this monorepo:
// `npx nx run server:content:sync`) after adding, renaming or removing a file
// under collections/ or pages/. The schema builder rewrites it on every apply.
//
// Two readers: plugins.ts registers `contentTypes` with ContentPlugin, and
// drizzle-kit diffs every top-level table export below into migrations.

import {
    contentEntryRevisions,
    joinTableOf,
    type AnyContentType
} from '@orthacms/content-server/define';
import { article } from './collections/article';
import { author } from './collections/author';
import { category } from './collections/category';
import { comment } from './collections/comment';
import { master_collection } from './collections/master_collection';
import { microsteps } from './collections/microsteps';
import { seo_meta } from './collections/seo_meta';
import { tag } from './collections/tag';
import { home_page } from './pages/home_page';
import { master_single } from './pages/master_single';
import { site_settings } from './pages/site_settings';

/** Every content type registered with ContentPlugin. */
export const contentTypes: readonly AnyContentType[] = [
    article,
    author,
    category,
    comment,
    master_collection,
    microsteps,
    seo_meta,
    tag,
    home_page,
    master_single,
    site_settings
];

/* Main tables — one `content_<name>` per type. */
export const articleTable = article.table;
export const authorTable = author.table;
export const categoryTable = category.table;
export const commentTable = comment.table;
export const masterCollectionTable = master_collection.table;
export const microstepsTable = microsteps.table;
export const seoMetaTable = seo_meta.table;
export const tagTable = tag.table;
export const homePageTable = home_page.table;
export const masterSingleTable = master_single.table;
export const siteSettingsTable = site_settings.table;

/* Join tables — one per many-relation. `joinTableOf` throws if one is gone. */
export const articleTagsJoinTable = joinTableOf(article, 'tags');
export const articleRelatedJoinTable = joinTableOf(article, 'related');
export const masterCollectionTagsJoinTable = joinTableOf(
    master_collection,
    'tags'
);
export const masterCollectionRelatedJoinTable = joinTableOf(
    master_collection,
    'related'
);
export const masterSingleTagsJoinTable = joinTableOf(master_single, 'tags');

/* The revision store — one fixed table, owned by content-server. */
export const contentEntryRevisionsTable = contentEntryRevisions;
