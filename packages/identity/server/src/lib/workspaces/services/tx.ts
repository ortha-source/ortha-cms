import type { Database } from '@ortha-cms/database';

/** The transaction client Drizzle hands to a `db.transaction(...)` callback. */
export type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];
