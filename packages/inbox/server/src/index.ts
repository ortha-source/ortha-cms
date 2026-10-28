/**
 * Public API of `@orthacms/inbox-server` — the in-app inbox (ADR-0023): one
 * table of things a person was told, the `/api/inbox` routes over their own
 * rows, and the `INBOX_WRITER` adapter producers inject optionally.
 */

export { InboxPlugin } from './lib/utils/inbox-plugin';
export { InboxModule } from './lib/inbox.module';
export { InboxService } from './lib/application/inbox.service';
export { inboxItems } from './lib/infrastructure/schema';
export type {
    InboxItemView,
    InboxPageView,
    InboxSummaryView
} from './lib/types/inbox-views';
