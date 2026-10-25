import { toActivityEvent, type ActivityEventResponse } from './index';

/** A wire row. */
function wire(
    overrides: Partial<ActivityEventResponse> = {}
): ActivityEventResponse {
    return {
        id: 'ev_1',
        kind: 'entry.published',
        subjectType: 'content_entry',
        subjectId: 'e_1',
        actorId: 'u_ada',
        actorType: 'user',
        actorEmail: 'ada@orthacms.dev',
        workspaceId: 'w_1',
        meta: { title: 'Spring launch' },
        at: '2026-10-24T10:42:00.000Z',
        ...overrides
    };
}

describe('toActivityEvent — the subject label', () => {
    it('carries the label the server froze on the row', () => {
        expect(
            toActivityEvent(wire({ subjectLabel: 'Spring launch' }))
                .subjectLabel
        ).toBe('Spring launch');
    });

    it('reads an absent label (an older server) as null, not as a guess', () => {
        expect(toActivityEvent(wire()).subjectLabel).toBeNull();
        expect(
            toActivityEvent(wire({ subjectLabel: null })).subjectLabel
        ).toBeNull();
    });
});
