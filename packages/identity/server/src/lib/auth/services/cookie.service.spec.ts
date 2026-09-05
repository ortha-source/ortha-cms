import type { CookieOptions, Request, Response } from 'express';
import type { IdentityPluginConfig, IdentitySsoConfig } from '../../types';
import {
    CookieService,
    SESSION_COOKIE,
    SSO_REQUEST_COOKIE
} from './cookie.service';

/**
 * `CookieService` — the only place in the plugin that knows a cookie exists.
 *
 * Three invariants are worth holding still:
 *
 * - **The SSO attempt cookie is always `SameSite=Lax`, whatever the config
 *   says.** The identity provider returns the person by a top-level
 *   cross-site navigation, and a `strict` cookie is not sent on one — the
 *   callback would find no attempt and *every* SSO sign-in would fail with a
 *   generic error, on a deployment whose config looks stricter and therefore
 *   safer. Its path is narrowed to the SSO routes for the same reason a session
 *   cookie is not: nothing else reads it. This is the *sibling* of the
 *   identity dossier's I-26 rather than a test of it, so it carries no
 *   citation: I-26 is `IdentityPlugin` refusing to boot with SSO providers
 *   and a `strict` session cookie, and nothing in this file would go red if
 *   that refusal were deleted. It is pinned in `utils/identity-plugin.spec.ts`
 *   and `apps/server-e2e/src/server/auth/identity-boot-refusal.spec.ts`.
 * - **`clearSession` mirrors `setSession`'s attributes.** A browser matches a
 *   cookie for deletion on name/domain/path, so a clear that forgets the path
 *   leaves the session cookie sitting in the browser after logout.
 * - **`readSession` parses the raw header itself.** There is no `cookie-parser`
 *   under it, so the pair-splitting, the whitespace and the empty-value case
 *   are this file's own code and not a library's.
 */
describe('CookieService', () => {
    function config(
        overrides: {
            cookieSecure?: boolean;
            cookieSameSite?: 'lax' | 'strict' | 'none';
            ttlSeconds?: number;
            sso?: IdentitySsoConfig;
        } = {}
    ): IdentityPluginConfig {
        return {
            allowedOrigins: ['https://cms.acme.com'],
            session: {
                ttlSeconds: overrides.ttlSeconds ?? 3600,
                cookieSecure: overrides.cookieSecure ?? true,
                cookieSameSite: overrides.cookieSameSite ?? 'lax'
            },
            token: { inviteTtlSeconds: 86400, resetTtlSeconds: 3600 },
            sso: overrides.sso
        };
    }

    interface ResponseDouble {
        res: Response;
        cookie: jest.Mock;
        clearCookie: jest.Mock;
    }

    /** A `Response` reduced to the two methods this service is allowed to call. */
    function responseDouble(): ResponseDouble {
        const cookie = jest.fn();
        const clearCookie = jest.fn();
        return {
            res: { cookie, clearCookie } as unknown as Response,
            cookie,
            clearCookie
        };
    }

    /** A `Request` carrying nothing but the raw `Cookie` header. */
    function requestWithCookieHeader(header?: string): Request {
        return {
            headers: header === undefined ? {} : { cookie: header }
        } as unknown as Request;
    }

    function service(
        overrides: Parameters<typeof config>[0] = {}
    ): CookieService {
        return new CookieService(config(overrides));
    }

    /** The options `res.cookie(name, value, options)` was handed. */
    function writtenOptions(cookie: jest.Mock): CookieOptions {
        return cookie.mock.calls[0][2] as CookieOptions;
    }

    /** The options `res.clearCookie(name, options)` was handed. */
    function clearedOptions(clearCookie: jest.Mock): CookieOptions {
        return clearCookie.mock.calls[0][1] as CookieOptions;
    }

    describe('setSession', () => {
        it('writes the token under the session cookie name', () => {
            const { res, cookie } = responseDouble();
            service().setSession(res, 'an-opaque-token');

            expect(cookie).toHaveBeenCalledTimes(1);
            expect(cookie.mock.calls[0][0]).toBe(SESSION_COOKIE);
            expect(cookie.mock.calls[0][1]).toBe('an-opaque-token');
        });

        it('keeps the cookie out of JavaScript and scoped to the whole app', () => {
            const { res, cookie } = responseDouble();
            service().setSession(res, 'an-opaque-token');

            expect(writtenOptions(cookie).httpOnly).toBe(true);
            expect(writtenOptions(cookie).path).toBe('/');
        });

        it('expresses the configured TTL in milliseconds', () => {
            const { res, cookie } = responseDouble();
            service({ ttlSeconds: 7200 }).setSession(res, 'an-opaque-token');

            expect(writtenOptions(cookie).maxAge).toBe(7_200_000);
        });

        it.each([['lax' as const], ['strict' as const], ['none' as const]])(
            'takes sameSite=%s from config rather than a literal',
            (sameSite) => {
                const { res, cookie } = responseDouble();
                service({ cookieSameSite: sameSite }).setSession(res, 'token');

                expect(writtenOptions(cookie).sameSite).toBe(sameSite);
            }
        );

        it.each([[true], [false]])(
            'takes secure=%s from config',
            (cookieSecure) => {
                const { res, cookie } = responseDouble();
                service({ cookieSecure }).setSession(res, 'token');

                expect(writtenOptions(cookie).secure).toBe(cookieSecure);
            }
        );
    });

    describe('clearSession', () => {
        it('clears the session cookie by name', () => {
            const { res, clearCookie } = responseDouble();
            service().clearSession(res);

            expect(clearCookie).toHaveBeenCalledTimes(1);
            expect(clearCookie.mock.calls[0][0]).toBe(SESSION_COOKIE);
        });

        it('repeats the attributes the browser matches on', () => {
            const { res, cookie, clearCookie } = responseDouble();
            const cookies = service({
                cookieSecure: false,
                cookieSameSite: 'strict'
            });
            cookies.setSession(res, 'token');
            cookies.clearSession(res);

            const written = writtenOptions(cookie);
            const cleared = clearedOptions(clearCookie);
            expect(cleared.secure).toBe(written.secure);
            expect(cleared.sameSite).toBe(written.sameSite);
            expect(cleared.path).toBe(written.path);
        });
    });

    describe('readSession', () => {
        function readWith(header?: string): string | null {
            return service().readSession(requestWithCookieHeader(header));
        }

        it.each([
            ['the only pair', `${SESSION_COOKIE}=abc123`],
            ['the first of several', `${SESSION_COOKIE}=abc123; theme=dark`],
            ['the last of several', `theme=dark; ${SESSION_COOKIE}=abc123`],
            [
                'a middle pair among many',
                `theme=dark; ${SESSION_COOKIE}=abc123; locale=en`
            ],
            [
                'a pair padded with whitespace',
                `theme=dark;   ${SESSION_COOKIE} = abc123 ; locale=en`
            ],
            [
                'a pair beside a valueless flag',
                `flag; ${SESSION_COOKIE}=abc123`
            ],
            [
                'a pair beside a similarly named cookie',
                `not_${SESSION_COOKIE}=nope; ${SESSION_COOKIE}=abc123`
            ]
        ])('reads the token from %s', (_label, header) => {
            expect(readWith(header)).toBe('abc123');
        });

        it('keeps a value that itself contains an equals sign', () => {
            expect(readWith(`${SESSION_COOKIE}=abc=123`)).toBe('abc=123');
        });

        it.each([
            ['there is no Cookie header at all', undefined],
            ['the header is empty', ''],
            ['the cookie is not among the pairs', 'theme=dark; locale=en'],
            ['the value is empty', `${SESSION_COOKIE}=`],
            ['the value is whitespace only', `${SESSION_COOKIE}=   `],
            ['the header holds no pairs at all', 'flag']
        ])('returns null when %s', (_label, header) => {
            expect(readWith(header)).toBeNull();
        });
    });

    describe('setSsoRequest', () => {
        const EXPIRES = new Date('2026-01-01T00:10:00.000Z');

        it('writes the attempt token under the SSO cookie name', () => {
            const { res, cookie } = responseDouble();
            service().setSsoRequest(res, 'attempt-token', EXPIRES);

            expect(cookie).toHaveBeenCalledTimes(1);
            expect(cookie.mock.calls[0][0]).toBe(SSO_REQUEST_COOKIE);
            expect(cookie.mock.calls[0][1]).toBe('attempt-token');
        });

        it.each([['lax' as const], ['strict' as const], ['none' as const]])(
            'pins sameSite to lax even when the session cookie is configured %s',
            (cookieSameSite) => {
                const { res, cookie } = responseDouble();
                service({ cookieSameSite }).setSsoRequest(
                    res,
                    'attempt-token',
                    EXPIRES
                );

                expect(writtenOptions(cookie).sameSite).toBe('lax');
            }
        );

        it('narrows the path to the SSO routes under the default API prefix', () => {
            const { res, cookie } = responseDouble();
            service().setSsoRequest(res, 'attempt-token', EXPIRES);

            expect(writtenOptions(cookie).path).toBe('/api/auth/sso');
        });

        it('follows a host that moved its global prefix', () => {
            const { res, cookie } = responseDouble();
            service({ sso: { apiPathPrefix: '/backend' } }).setSsoRequest(
                res,
                'attempt-token',
                EXPIRES
            );

            expect(writtenOptions(cookie).path).toBe('/backend/auth/sso');
        });

        it('expires with the attempt rather than on a lifetime of its own', () => {
            const { res, cookie } = responseDouble();
            service().setSsoRequest(res, 'attempt-token', EXPIRES);

            expect(writtenOptions(cookie).expires).toBe(EXPIRES);
            expect(writtenOptions(cookie).maxAge).toBeUndefined();
        });

        it('stays httpOnly and takes secure from the session config', () => {
            const { res, cookie } = responseDouble();
            service({ cookieSecure: false }).setSsoRequest(
                res,
                'attempt-token',
                EXPIRES
            );

            expect(writtenOptions(cookie).httpOnly).toBe(true);
            expect(writtenOptions(cookie).secure).toBe(false);
        });
    });

    describe('clearSsoRequest', () => {
        it('mirrors the attributes the attempt cookie was written with', () => {
            const { res, cookie, clearCookie } = responseDouble();
            const cookies = service({
                cookieSameSite: 'strict',
                sso: { apiPathPrefix: '/backend' }
            });
            cookies.setSsoRequest(
                res,
                'attempt-token',
                new Date('2026-01-01T00:10:00.000Z')
            );
            cookies.clearSsoRequest(res);

            expect(clearCookie.mock.calls[0][0]).toBe(SSO_REQUEST_COOKIE);
            expect(clearedOptions(clearCookie).sameSite).toBe(
                writtenOptions(cookie).sameSite
            );
            expect(clearedOptions(clearCookie).path).toBe(
                writtenOptions(cookie).path
            );
            expect(clearedOptions(clearCookie).secure).toBe(
                writtenOptions(cookie).secure
            );
        });
    });

    describe('readSsoRequest', () => {
        it('reads the attempt token out of the raw header', () => {
            expect(
                service().readSsoRequest(
                    requestWithCookieHeader(
                        `${SESSION_COOKIE}=abc; ${SSO_REQUEST_COOKIE}=xyz`
                    )
                )
            ).toBe('xyz');
        });

        it('returns null when only the session cookie is present', () => {
            expect(
                service().readSsoRequest(
                    requestWithCookieHeader(`${SESSION_COOKIE}=abc`)
                )
            ).toBeNull();
        });
    });
});
