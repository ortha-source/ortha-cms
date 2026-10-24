import {
    apiTokenStatusOf,
    EXPIRING_SOON_DAYS,
    expiringSoonCutoff,
    isExpiringSoon
} from './api-token-status';

const NOW = new Date('2026-10-24T12:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;
const inDays = (days: number) => new Date(NOW.getTime() + days * DAY);

describe('apiTokenStatusOf', () => {
    it('reads a token with no expiry and no revocation as active', () => {
        expect(
            apiTokenStatusOf({ expiresAt: null, revokedAt: null }, NOW)
        ).toBe('active');
    });

    it('reads a token past its expiry as expired, at the instant itself', () => {
        expect(apiTokenStatusOf({ expiresAt: NOW, revokedAt: null }, NOW)).toBe(
            'expired'
        );
    });

    it('lets revocation win over a future expiry [api-tokens:I-10]', () => {
        expect(
            apiTokenStatusOf({ expiresAt: inDays(10), revokedAt: NOW }, NOW)
        ).toBe('revoked');
    });

    it('lets revocation win over a past expiry too [api-tokens:I-10]', () => {
        expect(
            apiTokenStatusOf({ expiresAt: inDays(-10), revokedAt: NOW }, NOW)
        ).toBe('revoked');
    });
});

describe('isExpiringSoon', () => {
    it('flags a live token expiring inside the window', () => {
        expect(
            isExpiringSoon({ expiresAt: inDays(12), revokedAt: null }, NOW)
        ).toBe(true);
    });

    it('flags one expiring exactly at the edge of the window', () => {
        expect(
            isExpiringSoon(
                { expiresAt: inDays(EXPIRING_SOON_DAYS), revokedAt: null },
                NOW
            )
        ).toBe(true);
    });

    it('does not flag one just past the window', () => {
        expect(
            isExpiringSoon(
                {
                    expiresAt: inDays(EXPIRING_SOON_DAYS + 1),
                    revokedAt: null
                },
                NOW
            )
        ).toBe(false);
    });

    it('never flags a token that never expires', () => {
        expect(isExpiringSoon({ expiresAt: null, revokedAt: null }, NOW)).toBe(
            false
        );
    });

    it('does not flag one that has already stopped working', () => {
        // Expired and revoked tokens are past breaking; flagging them as
        // "about to" would bury the live ones that still can be saved.
        expect(
            isExpiringSoon({ expiresAt: inDays(-1), revokedAt: null }, NOW)
        ).toBe(false);
        expect(
            isExpiringSoon({ expiresAt: inDays(5), revokedAt: NOW }, NOW)
        ).toBe(false);
    });
});

describe('expiringSoonCutoff', () => {
    it('is the window length ahead of now', () => {
        expect(expiringSoonCutoff(NOW).getTime() - NOW.getTime()).toBe(
            EXPIRING_SOON_DAYS * DAY
        );
    });
});
