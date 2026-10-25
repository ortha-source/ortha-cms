/**
 * The few event kinds whose audit kind is not the same string — the renames
 * the server's mapper applies (`activity:I-11`, `I-12`). Everything else is
 * stored under the event's own kind.
 */
const RENAMED: Record<string, string> = {
    'member.removed': 'user.invite_revoked',
    'member.disabled': 'user.suspended',
    'member.reactivated': 'user.reactivated',
    'user.disabled': 'user.suspended',
    'user.enabled': 'user.reactivated',
    'auth.signed_in': 'user.signed_in',
    'auth.signed_out': 'user.signed_out',
    'auth.sign_in_failed': 'user.sign_in_failed'
};

/**
 * The audit kind a parked **outbox event** would have been recorded as, so the
 * dead-letter dialog can name it with the same label the log uses — "Changed
 * role", not `member.role_changed`.
 *
 * A parked row carries the domain event's kind, not the audit row's: the whole
 * point is that the row was never written. The mapping is the server's rename
 * table restated (`member.*` → `user.*`, `auth.*` → `user.*`, `api_token.*` →
 * `token.*`); a kind with no audit counterpart — a webhook delivery, a mail
 * send — passes through unchanged and the label falls back to the raw kind,
 * which is the honest answer for an event this log does not describe.
 */
export function auditKindOf(eventKind: string): string {
    const renamed = RENAMED[eventKind];
    if (renamed) return renamed;
    if (eventKind.startsWith('member.')) {
        return `user.${eventKind.slice('member.'.length)}`;
    }
    if (eventKind.startsWith('api_token.')) {
        return `token.${eventKind.slice('api_token.'.length)}`;
    }
    return eventKind;
}
