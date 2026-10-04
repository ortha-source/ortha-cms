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
    type AnyContentType
} from '@orthacms/content-server/define';

/** Every content type registered with ContentPlugin. */
export const contentTypes: readonly AnyContentType[] = [];

/* The revision store — one fixed table, owned by content-server. */
export const contentEntryRevisionsTable = contentEntryRevisions;
