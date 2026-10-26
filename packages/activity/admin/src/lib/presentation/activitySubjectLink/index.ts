import type { ActivityEvent } from '../../types/activityEvent';

/** Kinds after which the subject no longer exists to be opened. */
const GONE_KINDS = new Set<string>([
    'entry.deleted',
    'entry.purged',
    'workspace.deleted',
    'token.revoked',
    'media.asset.deleted',
    'media.folder.deleted',
    'segment.deleted',
    'alarm.rule.deleted',
    'saved_view.deleted',
    'copilot.skill.deleted'
]);

/** The workspace an event happened in — the row's own, else `meta`'s. */
export function eventWorkspaceId(event: ActivityEvent): string | null {
    if (event.workspaceId) return event.workspaceId;
    const fromMeta = event.meta?.['workspaceId'];
    return typeof fromMeta === 'string' && fromMeta !== '' ? fromMeta : null;
}

/**
 * Where "Open {subject}" goes, or `null` when the admin has no page for the
 * subject or the event itself removed it.
 *
 * Only routes this plugin can name without importing their owners: a member
 * (`/users/:id`), a workspace (`/workspaces/:id`), the API tokens list, and an
 * entry in its workspace's library (`/workspaces/:id/content/:type/:entry`,
 * which needs both the row's workspace and the content type the server froze
 * on it). A guess is worse than no link — the button is simply not offered.
 */
export function subjectHref(event: ActivityEvent): string | null {
    if (GONE_KINDS.has(event.kind) || !event.subjectId) return null;
    const id = encodeURIComponent(event.subjectId);
    switch (event.subjectType) {
        case 'user':
            return `/users/${id}`;
        case 'workspace':
            return `/workspaces/${id}`;
        case 'api_token':
            return '/api-tokens';
        case 'content_entry': {
            const workspaceId = eventWorkspaceId(event);
            const type = event.meta?.['contentType'];
            if (!workspaceId || typeof type !== 'string' || type === '') {
                return null;
            }
            return `/workspaces/${encodeURIComponent(workspaceId)}/content/${encodeURIComponent(type)}/${id}`;
        }
        default:
            return null;
    }
}
