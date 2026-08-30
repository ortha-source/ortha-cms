import { describe, expect, it } from 'vitest';
import { inviteLinkFor } from './index';
import { passwordResetLinkFor } from '../passwordResetLink';

/**
 * The link is the whole hand-off: no mailer exists yet, so whatever this string
 * says is what the admin pastes into a chat window, and a wrong path or a
 * mangled token is only discoverable by the invitee failing to sign up. The
 * origin is read from the browser (see the module docblock), so jsdom's own
 * origin is the fixture — asserting against `window.location.origin` rather
 * than a literal keeps the test honest if the runner's URL ever changes.
 */
describe('inviteLinkFor', () => {
    const origin = window.location.origin;

    it('builds the accept-invite URL for the token', () => {
        expect(inviteLinkFor('abc')).toBe(
            `${origin}/identity/accept-invite?token=abc`
        );
    });

    it('points somewhere other than the password-reset link', () => {
        // The two builders are two lines apart and near-identical; a copy-paste
        // between them would send an invitee to the reset screen, where they
        // have no account to reset and no way back to the invite.
        expect(inviteLinkFor('abc')).not.toBe(passwordResetLinkFor('abc'));
    });

    it('percent-encodes a token that carries URL-significant characters', () => {
        // The token is opaque and may well be base64, whose `+ / =` all mean
        // something else in a query string. Going through `URLSearchParams`
        // rather than concatenating is what keeps the redeemed token identical
        // to the minted one.
        expect(inviteLinkFor('a+b/c=')).toBe(
            `${origin}/identity/accept-invite?token=a%2Bb%2Fc%3D`
        );
    });
});
