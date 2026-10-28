/**
 * Public API of `@orthacms/inbox-admin` — the in-app inbox (ADR-0023): the
 * `/inbox` page, its sidebar row with the unread count, and its button in the
 * workspace sidebar's header.
 */

export { InboxPlugin } from './lib/presentation/inboxPlugin';
export type { InboxAdminPlugin } from './lib/presentation/inboxPlugin';
export { useInboxSummary } from './lib/application/hooks';
// Notification settings: a plugin adds a section to `/inbox/settings` here.
export { INBOX_SETTINGS_SLOT } from './lib/presentation/slots/inboxSlots';
export type { InboxSettingsSection } from './lib/presentation/slots/inboxSlots';
export type { InboxItem, InboxSummary } from './lib/domain/types';
