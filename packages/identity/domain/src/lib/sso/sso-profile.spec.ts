import {
    assertSsoProfile,
    MalformedSsoProfileError,
    normalizeSsoProfile,
    type SsoProfile
} from './sso-profile';

const profile = (over: Partial<SsoProfile> = {}): SsoProfile => ({
    subject: 'idp-subject-1',
    email: 'ada@example.com',
    emailVerified: true,
    ...over
});

describe('assertSsoProfile', () => {
    it('accepts a well-formed profile', () => {
        expect(() => assertSsoProfile(profile())).not.toThrow();
    });

    it.each([
        ['an empty subject', { subject: '' }],
        ['a blank subject', { subject: '   ' }],
        ['an empty email', { email: '' }]
    ])('rejects %s', (_label, over) => {
        expect(() => assertSsoProfile(profile(over))).toThrow(
            MalformedSsoProfileError
        );
    });

    it('rejects a non-boolean emailVerified, because it reports nothing', () => {
        expect(() =>
            assertSsoProfile(
                profile({ emailVerified: undefined as unknown as boolean })
            )
        ).toThrow(MalformedSsoProfileError);
    });

    it('rejects a subject that is just the email address', () => {
        expect(() =>
            assertSsoProfile(
                profile({
                    subject: 'ADA@example.com',
                    email: 'ada@example.com'
                })
            )
        ).toThrow(/not a stable identifier/);
    });
});

describe('normalizeSsoProfile', () => {
    it('lower-cases the email and trims the subject', () => {
        expect(
            normalizeSsoProfile(
                profile({ subject: ' idp-1 ', email: ' Ada@Example.COM ' })
            )
        ).toMatchObject({ subject: 'idp-1', email: 'ada@example.com' });
    });

    it('collapses a blank name to null, so the column is not spaces', () => {
        expect(normalizeSsoProfile(profile({ name: '  ' })).name).toBeNull();
    });

    it('passes the group claims through untouched, so the role resolver sees what the provider said', () => {
        const groups = ['  Platform Editors  ', 'admins'];
        expect(normalizeSsoProfile(profile({ groups })).groups).toEqual(groups);
    });

    it('passes the provider session id through untouched, so a back-channel logout can still find it', () => {
        expect(
            normalizeSsoProfile(profile({ sessionId: ' sid-42 ' })).sessionId
        ).toBe(' sid-42 ');
    });
});
