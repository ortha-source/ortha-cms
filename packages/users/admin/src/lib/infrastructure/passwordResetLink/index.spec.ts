import { describe, expect, it } from 'vitest';
import { passwordResetLinkFor } from './index';
import { inviteLinkFor } from '../inviteLink';

/**
 * Same stakes as the invite link, and slightly worse: the server refuses a
 * second mint for a minute, so a link that is subtly wrong cannot simply be
 * re-issued. The origin is the browser's (see the module docblock), so jsdom's
 * own origin is the fixture.
 */
describe('passwordResetLinkFor', () => {
    const origin = window.location.origin;

    it('builds the reset-password URL for the token', () => {
        expect(passwordResetLinkFor('abc')).toBe(
            `${origin}/identity/reset-password?token=abc`
        );
    });

    it('points somewhere other than the invite link', () => {
        // Mirrors the assertion on the invite side: the two paths must stay
        // distinct, and only one of the two files needs to drift for that to
        // stop being true.
        expect(passwordResetLinkFor('abc')).not.toBe(inviteLinkFor('abc'));
    });

    it('percent-encodes a token that carries URL-significant characters', () => {
        expect(passwordResetLinkFor('a+b/c=')).toBe(
            `${origin}/identity/reset-password?token=a%2Bb%2Fc%3D`
        );
    });
});
