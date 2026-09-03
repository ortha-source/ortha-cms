import { matches, type WebhookSubscription } from './subscription';

const WORKSPACE = '11111111-1111-1111-1111-111111111111';
const OTHER_WORKSPACE = '22222222-2222-2222-2222-222222222222';

function subscription(
    overrides: Partial<WebhookSubscription> = {}
): WebhookSubscription {
    return {
        enabled: true,
        allWorkspaces: false,
        workspaceIds: [WORKSPACE],
        eventKinds: [],
        contentTypes: [],
        ...overrides
    };
}

const published = {
    kind: 'entry.published',
    workspaceId: WORKSPACE,
    contentType: 'article'
};

describe('matches', () => {
    it('delivers an event that clears all three filters', () => {
        expect(matches(subscription(), published)).toBe(true);
    });

    it('never delivers to a disabled endpoint', () => {
        expect(matches(subscription({ enabled: false }), published)).toBe(
            false
        );
    });

    describe('the empty set means "everything" [webhooks:I-03]', () => {
        it('an empty kind list takes every kind', () => {
            expect(
                matches(subscription({ eventKinds: [] }), {
                    ...published,
                    kind: 'entry.purged'
                })
            ).toBe(true);
        });

        it('an empty content-type list takes every type', () => {
            expect(
                matches(subscription({ contentTypes: [] }), {
                    ...published,
                    contentType: 'anything-at-all'
                })
            ).toBe(true);
        });

        it('allWorkspaces takes a workspace the endpoint never named', () => {
            expect(
                matches(
                    subscription({ allWorkspaces: true, workspaceIds: [] }),
                    { ...published, workspaceId: OTHER_WORKSPACE }
                )
            ).toBe(true);
        });
    });

    describe('a named set excludes what it does not name', () => {
        it('filters by kind', () => {
            expect(
                matches(subscription({ eventKinds: ['entry.published'] }), {
                    ...published,
                    kind: 'entry.deleted'
                })
            ).toBe(false);
        });

        it('filters by content type', () => {
            expect(
                matches(subscription({ contentTypes: ['article'] }), {
                    ...published,
                    contentType: 'product'
                })
            ).toBe(false);
        });

        it('filters by workspace', () => {
            expect(
                matches(subscription(), {
                    ...published,
                    workspaceId: OTHER_WORKSPACE
                })
            ).toBe(false);
        });
    });

    it('refuses a kind that is not in the catalogue [webhooks:I-05]', () => {
        // Without a descriptor there is no way to know whether the workspace or
        // content-type filters even apply, so the safe answer is "not yours".
        expect(
            matches(subscription({ allWorkspaces: true }), {
                kind: 'user.password_changed',
                workspaceId: null,
                contentType: null
            })
        ).toBe(false);
    });

    describe('an entry with no workspace', () => {
        const orphan = { ...published, workspaceId: null };

        it('reaches only an endpoint that takes every workspace', () => {
            expect(matches(subscription({ allWorkspaces: true }), orphan)).toBe(
                true
            );
        });

        it('cannot satisfy a filter that names specific workspaces', () => {
            expect(matches(subscription(), orphan)).toBe(false);
        });
    });

    describe('ping', () => {
        const ping = { kind: 'ping', workspaceId: null, contentType: null };

        it('ignores both filters — it is addressed to one endpoint by hand', () => {
            expect(
                matches(
                    subscription({
                        workspaceIds: [WORKSPACE],
                        contentTypes: ['article']
                    }),
                    ping
                )
            ).toBe(true);
        });
    });
});
