import { ACTIVITY_KINDS } from '../../types/activityKinds';
import { auditKindOf } from './index';

describe('a parked event’s audit kind', () => {
    it.each([
        ['member.role_changed', 'user.role_changed'],
        ['member.invited', 'user.invited'],
        ['member.removed', 'user.invite_revoked'],
        ['member.disabled', 'user.suspended'],
        ['user.disabled', 'user.suspended'],
        ['user.enabled', 'user.reactivated'],
        ['auth.signed_in', 'user.signed_in'],
        ['auth.sign_in_failed', 'user.sign_in_failed'],
        ['api_token.created', 'token.created'],
        ['entry.published', 'entry.published']
    ])('%s is labelled as %s', (eventKind, auditKind) => {
        expect(auditKindOf(eventKind)).toBe(auditKind);
        expect(ACTIVITY_KINDS as readonly string[]).toContain(auditKind);
    });

    it('passes a kind with no audit counterpart through untouched', () => {
        expect(auditKindOf('webhook.delivery_requested')).toBe(
            'webhook.delivery_requested'
        );
    });
});
