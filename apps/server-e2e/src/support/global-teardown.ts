/* eslint-disable */
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { clearDatabaseUrl } from './db-url';

module.exports = async function () {
    const container = (globalThis as any).__PG_CONTAINER__ as
        | StartedPostgreSqlContainer
        | undefined;
    if (container) {
        await container.stop();
        console.log('[e2e] testcontainer stopped.');
    }
    clearDatabaseUrl();
};
