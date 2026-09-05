import type { IdentityPluginConfig, IdentitySsoConfig } from '../types';
import {
    DEFAULT_SSO_REQUEST_TTL_SECONDS,
    ssoCallbackUrl,
    ssoFailureUrl,
    ssoPublicBaseUrl,
    ssoRequestTtlSeconds,
    ssoSuccessUrl
} from './sso-settings';

/**
 * The SSO settings readers — four pure functions that turn plugin config into
 * the absolute URLs an identity provider is handed.
 *
 * They exist so the strings are built in exactly one place, and the tests below
 * are about the ways a second place would get them wrong:
 *
 * - a **trailing slash** on the configured base yields `https://host//api/...`,
 *   which most providers treat as a different `redirect_uri` than the one that
 *   was registered and reject at the token exchange as a bare `invalid_grant`;
 * - the **base is configured, never derived from the request** — a `Host`
 *   header is client-controlled, so falling back to it would let a caller
 *   choose the origin the provider redirects to. With nothing configured the
 *   right answer is a loud error, not a guess;
 * - **failure always lands on the sign-in screen with `?error=sso`** (identity:I-20).
 *   The person is mid-redirect from a third party; a bare 401 is honest and
 *   useless.
 */
describe('sso-settings', () => {
    function config(
        sso?: IdentitySsoConfig,
        allowedOrigins: string[] = ['https://cms.acme.com']
    ): IdentityPluginConfig {
        return {
            allowedOrigins,
            session: {
                ttlSeconds: 3600,
                cookieSecure: true,
                cookieSameSite: 'lax'
            },
            token: { inviteTtlSeconds: 86400, resetTtlSeconds: 3600 },
            sso
        };
    }

    describe('ssoPublicBaseUrl', () => {
        it('prefers the configured public base URL', () => {
            expect(
                ssoPublicBaseUrl(
                    config({ publicBaseUrl: 'https://api.acme.com' }, [
                        'https://admin.acme.com'
                    ])
                )
            ).toBe('https://api.acme.com');
        });

        it('falls back to the first allowed origin when none is configured', () => {
            expect(
                ssoPublicBaseUrl(
                    config(undefined, [
                        'https://admin.acme.com',
                        'https://other.acme.com'
                    ])
                )
            ).toBe('https://admin.acme.com');
        });

        it.each([
            ['an empty string', ''],
            ['whitespace only', '   ']
        ])('falls back to the first allowed origin for %s', (_label, value) => {
            expect(
                ssoPublicBaseUrl(
                    config({ publicBaseUrl: value }, ['https://admin.acme.com'])
                )
            ).toBe('https://admin.acme.com');
        });

        it.each([
            ['one trailing slash', 'https://cms.acme.com/'],
            ['several trailing slashes', 'https://cms.acme.com///']
        ])('strips %s', (_label, value) => {
            expect(ssoPublicBaseUrl(config({ publicBaseUrl: value }))).toBe(
                'https://cms.acme.com'
            );
        });

        it('trims surrounding whitespace off the configured value', () => {
            expect(
                ssoPublicBaseUrl(
                    config({ publicBaseUrl: '  https://cms.acme.com  ' })
                )
            ).toBe('https://cms.acme.com');
        });

        it('throws a directive error when neither source has a value', () => {
            expect(() => ssoPublicBaseUrl(config(undefined, []))).toThrow(
                /publicBaseUrl/
            );
        });

        it('names allowedOrigins as the other way to satisfy it', () => {
            expect(() => ssoPublicBaseUrl(config({}, []))).toThrow(
                /allowedOrigins/
            );
        });
    });

    describe('ssoCallbackUrl', () => {
        it('defaults the API prefix to /api', () => {
            expect(ssoCallbackUrl(config(), 'google')).toBe(
                'https://cms.acme.com/api/auth/sso/google/callback'
            );
        });

        it('normalizes a base carrying a trailing slash', () => {
            expect(
                ssoCallbackUrl(
                    config({ publicBaseUrl: 'https://cms.acme.com/' }),
                    'google'
                )
            ).toBe('https://cms.acme.com/api/auth/sso/google/callback');
        });

        it('honours a host that moved its global prefix', () => {
            expect(
                ssoCallbackUrl(config({ apiPathPrefix: '/backend' }), 'okta')
            ).toBe('https://cms.acme.com/backend/auth/sso/okta/callback');
        });

        it('places the provider name between the prefix and /callback', () => {
            expect(ssoCallbackUrl(config(), 'entra-id')).toBe(
                'https://cms.acme.com/api/auth/sso/entra-id/callback'
            );
        });

        it('builds on the allowed-origin fallback like the base reader does', () => {
            expect(
                ssoCallbackUrl(
                    config(undefined, ['https://admin.acme.com/']),
                    'google'
                )
            ).toBe('https://admin.acme.com/api/auth/sso/google/callback');
        });
    });

    describe('ssoFailureUrl', () => {
        it('defaults to the admin sign-in path with the sso error flag', () => {
            expect(ssoFailureUrl(config())).toBe(
                'https://cms.acme.com/identity/signin?error=sso'
            );
        });

        it('honours a configured sign-in path, keeping the flag', () => {
            expect(ssoFailureUrl(config({ signInPath: '/login' }))).toBe(
                'https://cms.acme.com/login?error=sso'
            );
        });

        it('normalizes the base the same way the callback URL does', () => {
            expect(
                ssoFailureUrl(
                    config({ publicBaseUrl: 'https://cms.acme.com/' })
                )
            ).toBe('https://cms.acme.com/identity/signin?error=sso');
        });
    });

    describe('ssoSuccessUrl', () => {
        it('appends the already-validated path to the public base', () => {
            expect(ssoSuccessUrl(config(), '/workspaces/1/content')).toBe(
                'https://cms.acme.com/workspaces/1/content'
            );
        });

        it('normalizes the base before appending', () => {
            expect(
                ssoSuccessUrl(
                    config({ publicBaseUrl: 'https://cms.acme.com/' }),
                    '/'
                )
            ).toBe('https://cms.acme.com/');
        });
    });

    describe('ssoRequestTtlSeconds', () => {
        it('defaults to ten minutes when the host names no TTL', () => {
            expect(ssoRequestTtlSeconds(config())).toBe(
                DEFAULT_SSO_REQUEST_TTL_SECONDS
            );
            expect(DEFAULT_SSO_REQUEST_TTL_SECONDS).toBe(600);
        });

        it('defaults when the whole sso block is absent', () => {
            expect(ssoRequestTtlSeconds(config(undefined))).toBe(600);
        });

        it('returns the configured TTL when one is given', () => {
            expect(
                ssoRequestTtlSeconds(config({ requestTtlSeconds: 120 }))
            ).toBe(120);
        });

        it('returns a configured zero rather than treating it as absent', () => {
            expect(ssoRequestTtlSeconds(config({ requestTtlSeconds: 0 }))).toBe(
                0
            );
        });
    });
});
