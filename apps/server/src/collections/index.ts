/**
 * The host's code-defined content types. Add a collection by creating a
 * file here, exporting it from this barrel, registering it in
 * `contentTypes`, and re-exporting its tables from `./schema` — then run
 * `npx nx run server:db:generate --name=<change>` and commit the SQL.
 */

import type { AnyContentType } from '@ortha-cms/content-server/define';
import { author } from './author';
import { home } from './home';
import { post } from './post';
import { tag } from './tag';

export { author, home, post, tag };

/** Every content type registered with ContentPlugin, in one place. */
export const contentTypes: readonly AnyContentType[] = [
    author,
    tag,
    post,
    home
];
