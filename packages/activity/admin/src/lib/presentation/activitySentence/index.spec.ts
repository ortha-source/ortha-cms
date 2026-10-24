import type { IntlShape, MessageDescriptor } from 'react-intl';
import type { ActivityEvent } from '../../types/activityEvent';
import {
    ACTIVITY_KINDS,
    ACTIVITY_SUBJECT_TYPES
} from '../../types/activityKinds';
import {
    SENTENCE_MESSAGES,
    SUBJECT_NOUN_MESSAGES,
    activityObjectName,
    activityTone,
    formatRole,
    sentenceDescriptor,
    sentenceValues
} from './index';

/** Enough of an `IntlShape`: it returns the default message. */
const intl = {
    formatMessage: (descriptor: MessageDescriptor) =>
        String(descriptor.defaultMessage)
} as unknown as IntlShape;

/** An event with sensible defaults. */
function event(overrides: Partial<ActivityEvent> = {}): ActivityEvent {
    return {
        id: 'ev_1',
        kind: 'entry.published',
        subjectType: 'content_entry',
        subjectId: 'e_1',
        subjectLabel: null,
        actor: { id: 'u_ada', email: 'ada@orthacms.dev', type: 'user' },
        meta: null,
        workspaceId: null,
        at: new Date('2026-10-24T10:42:00.000Z'),
        ...overrides
    };
}

describe('the feed sentence catalogue', () => {
    it('has a sentence for every kind the log can render, and nothing else', () => {
        expect(Object.keys(SENTENCE_MESSAGES).sort()).toEqual(
            [...ACTIVITY_KINDS].sort()
        );
    });

    it('has a noun for every subject type', () => {
        expect(Object.keys(SUBJECT_NOUN_MESSAGES).sort()).toEqual(
            [...ACTIVITY_SUBJECT_TYPES].sort()
        );
    });

    it('gives every sentence its own id under activity.sentence', () => {
        const ids = Object.values(SENTENCE_MESSAGES).map((m) => m.id);
        expect(new Set(ids).size).toBe(ids.length);
        for (const [kind, message] of Object.entries(SENTENCE_MESSAGES)) {
            expect(message.id).toBe(`activity.sentence.${kind}`);
        }
    });

    it('names the object in every sentence that has one to name', () => {
        // A sentence that forgets `{object}` would describe the action and
        // never say what it was done to.
        const objectless = new Set([
            'user.activated',
            'user.password_changed',
            'user.signed_in',
            'user.signed_out',
            'copilot.tool_permission.decided'
        ]);
        for (const [kind, message] of Object.entries(SENTENCE_MESSAGES)) {
            if (objectless.has(kind)) continue;
            expect(`${kind}: ${String(message.defaultMessage)}`).toContain(
                '{object}'
            );
        }
    });

    it('answers null for a kind it does not know, so the row falls back', () => {
        expect(sentenceDescriptor('webhook.delivery_retried')).toBeNull();
        expect(sentenceDescriptor('entry.published')).toBe(
            SENTENCE_MESSAGES['entry.published']
        );
    });
});

describe('what a sentence names', () => {
    it('prefers the label the server froze on the row', () => {
        expect(
            activityObjectName(
                event({
                    subjectLabel: 'Spring launch — what changed',
                    meta: { title: 'Older title' }
                })
            )
        ).toBe('Spring launch — what changed');
    });

    it('falls back to meta for a row written before the label existed', () => {
        expect(
            activityObjectName(event({ meta: { title: 'Pricing FAQ' } }))
        ).toBe('Pricing FAQ');
        expect(
            activityObjectName(
                event({
                    kind: 'user.invited',
                    meta: { email: 'lena@growth.io' }
                })
            )
        ).toBe('lena@growth.io');
        // A transition is not a name.
        expect(
            activityObjectName(
                event({ meta: { name: { from: 'a', to: 'b' } } })
            )
        ).toBeNull();
    });

    it('reads a content type’s id as its name', () => {
        expect(
            activityObjectName(
                event({ subjectType: 'content_type', subjectId: 'article' })
            )
        ).toBe('article');
    });

    it('says "a member" rather than a uuid when nothing names the subject', () => {
        const values = sentenceValues(
            intl,
            event({
                kind: 'user.role_changed',
                subjectType: 'user',
                meta: { from: 'contributor', to: 'admin' }
            })
        );
        expect(values.object).toBe('a member');
        expect(values.to).toBe('Admin');
        expect(values.hasTo).toBe('yes');
    });

    it('names a system event "System" and carries where a sign-in came from', () => {
        const values = sentenceValues(
            intl,
            event({
                kind: 'user.signed_in',
                actor: null,
                meta: { ipAddress: '84.22.19.4' }
            })
        );
        expect(values.actor).toBe('System');
        expect(values.origin).toBe('84.22.19.4');
        expect(values.hasOrigin).toBe('yes');
    });

    it('capitalises a role key and nothing more', () => {
        expect(formatRole('admin')).toBe('Admin');
        expect(formatRole('Content lead')).toBe('Content lead');
    });
});

describe('the action tile’s tone', () => {
    it.each([
        ['entry.published', 'success'],
        ['entry.created', 'success'],
        ['user.role_changed', 'info'],
        ['user.invited', 'info'],
        ['token.created', 'warning'],
        ['entry.deleted', 'danger'],
        ['entry.purged', 'danger'],
        ['token.revoked', 'danger'],
        ['user.sign_in_failed', 'danger'],
        ['entry.updated', 'muted'],
        ['user.signed_in', 'muted'],
        ['something.unknown', 'muted']
    ])('%s reads as %s', (kind, tone) => {
        expect(activityTone(kind)).toBe(tone);
    });
});
