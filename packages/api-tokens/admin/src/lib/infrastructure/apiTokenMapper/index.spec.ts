import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    toApiToken,
    toCreatedApiToken,
    type ApiTokenResponse,
    type CreatedApiTokenResponse
} from './index';

/** A live, never-expiring token; each test overrides only what it is about. */
function response(overrides: Partial<ApiTokenResponse> = {}): ApiTokenResponse {
    return {
        id: 'tok_1',
        name: 'Production website',
        workspaceIds: ['ws_1'],
        scope: 'read',
        lookupPrefix: 'ort_a1b2c3',
        expiresAt: null,
        lastUsedAt: null,
        revokedAt: null,
        createdAt: '2026-06-01T10:00:00.000Z',
        ...overrides
    };
}

/** The instant every status test is measured against. */
const NOW = new Date('2026-08-01T12:00:00.000Z');
const PAST = '2026-07-01T12:00:00.000Z';
const FUTURE = '2026-09-01T12:00:00.000Z';

/**
 * The wire → view mapper. Its one decision is `status`, which is **derived**
 * rather than read: the server sends `expiresAt` and `revokedAt` and the admin
 * works out the label. That makes the ordering of the two tests load-bearing —
 * a token can be both revoked and expired at once, and the table's kebab is
 * offered only on `active`, so mislabelling is what decides whether a live
 * credential can still be revoked from the UI.
 *
 * `statusOf` itself is module-private, so it is exercised through
 * `toApiToken`'s `status` — the only way the rest of the plugin ever sees it,
 * and one that needs no production export to test.
 */
describe('toApiToken', () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    /** Pins "now" so a fixed expiry timestamp means the same thing every run. */
    function at(now: Date) {
        vi.useFakeTimers();
        vi.setSystemTime(now);
    }

    it('reports a revoked token as revoked even while its expiry is in the future', () => {
        at(NOW);

        const token = toApiToken(
            response({ revokedAt: PAST, expiresAt: FUTURE })
        );

        expect(token.status).toBe('revoked');
    });

    // The other order of the same collision. Revocation is deliberate and
    // expiry is not, so "revoked" is the truthful label whichever came first —
    // and the branch order in `statusOf` is the only thing enforcing it.
    it('reports a revoked token as revoked when its expiry has also passed', () => {
        at(NOW);

        const token = toApiToken(
            response({ revokedAt: PAST, expiresAt: PAST })
        );

        expect(token.status).toBe('revoked');
    });

    // The boundary: the comparison is `<=`, so an expiry landing exactly on the
    // current instant is already spent. A `<` here would leave the table calling
    // a dead token active and offering its Revoke.
    it('reports a token whose expiry is exactly now as expired', () => {
        at(NOW);

        const token = toApiToken(response({ expiresAt: NOW.toISOString() }));

        expect(token.status).toBe('expired');
    });

    it('reports a token whose expiry has passed as expired', () => {
        at(NOW);

        expect(toApiToken(response({ expiresAt: PAST })).status).toBe(
            'expired'
        );
    });

    it('reports a live token as active, whether or not it ever expires', () => {
        at(NOW);

        expect(toApiToken(response({ expiresAt: FUTURE })).status).toBe(
            'active'
        );
        expect(toApiToken(response({ expiresAt: null })).status).toBe('active');
    });

    it('parses the timestamps into Dates and leaves the absent ones null', () => {
        const token = toApiToken(
            response({
                expiresAt: FUTURE,
                lastUsedAt: PAST,
                revokedAt: null,
                createdAt: '2026-06-01T10:00:00.000Z'
            })
        );

        expect(token.expiresAt).toEqual(new Date(FUTURE));
        expect(token.lastUsedAt).toEqual(new Date(PAST));
        expect(token.revokedAt).toBeNull();
        expect(token.createdAt).toEqual(new Date('2026-06-01T10:00:00.000Z'));
    });

    /**
     * The plaintext must exist on exactly one shape. `toApiToken` builds its
     * result field by field rather than spreading the DTO, and this is the test
     * that keeps it that way: a `{ ...dto }` refactor would carry a `secret`
     * onto every row of a list response, where it would reach the table, the
     * query cache, and anything that serialises either.
     */
    it('never carries a secret, even when handed a response that has one', () => {
        const created: CreatedApiTokenResponse = {
            ...response(),
            secret: 'ort_live_supersecret'
        };

        const token = toApiToken(created);

        expect('secret' in token).toBe(false);
        expect(JSON.stringify(token)).not.toContain('supersecret');
    });
});

describe('toCreatedApiToken', () => {
    // The mirror of the test above: the create response is the one place the
    // plaintext is allowed through, because it is the only time the server will
    // ever send it.
    it('carries the one-time secret onto the created token', () => {
        const created = toCreatedApiToken({
            ...response(),
            secret: 'ort_live_supersecret'
        });

        expect(created.secret).toBe('ort_live_supersecret');
        // …and everything the list shape has, so the reveal dialog's caller can
        // treat it as a row too.
        expect(created.id).toBe('tok_1');
        expect(created.status).toBe('active');
    });
});
