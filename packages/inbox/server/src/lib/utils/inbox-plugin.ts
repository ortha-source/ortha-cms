import { join } from 'node:path';
import type { ServerPlugin } from '@orthacms/bootstrap-server';
import { InboxModule } from '../inbox.module';
import { describeInboxApi } from '../docs/describe-inbox-api';

/**
 * Server plugin for the in-app inbox (ADR-0023). Takes no configuration and
 * ships its own migrations, tracked under `__drizzle_migrations_inbox`.
 * Register it **before** the plugins that write to it (protection, alarms) so
 * its table exists when theirs reference nothing of it — they inject its
 * writer optionally, and run unchanged without it.
 */
export function InboxPlugin(): ServerPlugin {
    return {
        name: 'inbox',
        module: InboxModule.forRoot(),
        migrations: {
            dir: () => join(__dirname, '../../../migrations'),
            table: '__drizzle_migrations_inbox'
        },
        docs: { decorate: describeInboxApi }
    };
}
