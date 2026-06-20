/**
 * The host's code-defined content types — one aggregation point for two
 * consumers:
 *
 * - `plugins.ts` reads `contentTypes` to register them with `ContentPlugin`.
 * - drizzle-kit reads this file (`drizzle.config.ts → schema`) and diffs the
 *   re-exported tables into migrations. drizzle-kit only diffs **top-level
 *   table exports**, so every generated table — including many-relation join
 *   tables — must be surfaced below (via `joinTableOf`, which throws if a
 *   relation was renamed rather than silently dropping it from the diff).
 *
 * Add a type by creating a file under `./collections` or `./pages`, then
 * register it in `contentTypes` and re-export its table(s) here — and run
 * `npx nx run server:db:generate --name=<change>`, committing the SQL.
 */

import { joinTableOf, type AnyContentType } from '@ortha-cms/content-server/define';
import { article } from './collections/article';
import { landing } from './pages/landing';

/** Every content type registered with ContentPlugin, in one place. */
export const contentTypes: readonly AnyContentType[] = [article, landing];

// --- drizzle-kit schema: physical tables re-exported for migration diffing ---
export const articles = article.table;
/** article.related many-to-many self-join. */
export const articleRelated = joinTableOf(article, 'related');
export const landingPage = landing.table;
/** landing.picks many-to-many join. */
export const landingPicks = joinTableOf(landing, 'picks');
