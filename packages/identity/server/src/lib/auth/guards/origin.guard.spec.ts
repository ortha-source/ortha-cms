import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { OriginGuard } from './origin.guard';
import type { IdentityPluginConfig } from '../../types';

const APP_ORIGIN = 'https://admin.example.com';

/** An `ExecutionContext` carrying nothing but the headers a guard reads. */
function contextWith(headers: Record<string, string>): ExecutionContext {
    return {
        switchToHttp: () => ({ getRequest: () => ({ headers }) })
    } as unknown as ExecutionContext;
}

function guard(...allowedOrigins: string[]): OriginGuard {
    return new OriginGuard({
        allowedOrigins
    } as IdentityPluginConfig);
}

/**
 * `OriginGuard` — the login-CSRF defense on state-changing routes. The design
 * rests on one browser fact: a browser always attaches `Origin` to a cross-site
 * POST, so a *missing* header cannot be the attack this guard exists to block,
 * while a *foreign* one is exactly it. Both halves are asserted here because
 * either one drifting quietly breaks something real — tightening the first
 * locks out every non-browser client, loosening the second reopens the hole.
 *
 * Exercised without the Nest testing module: the guard reads one header off the
 * request and one list off its config, and a hand-built context says that more
 * plainly than a DI container would.
 */
describe('OriginGuard', () => {
    it('lets a request with no Origin header through', () => {
        // Non-browser clients (curl, a server-to-server call) and same-origin
        // navigations send none, and they are not the cross-site POST this
        // guard is aimed at.
        expect(guard(APP_ORIGIN).canActivate(contextWith({}))).toBe(true);
    });

    it('lets an allow-listed origin through', () => {
        expect(
            guard(APP_ORIGIN).canActivate(contextWith({ origin: APP_ORIGIN }))
        ).toBe(true);
    });

    it('refuses an origin that is not on the list', () => {
        expect(() =>
            guard(APP_ORIGIN).canActivate(
                contextWith({ origin: 'https://evil.example.com' })
            )
        ).toThrow(ForbiddenException);
    });

    it('matches an origin exactly, not by prefix or suffix', () => {
        // `https://admin.example.com.evil.test` is a different site that a
        // sloppy `startsWith`/`endsWith` check would happily admit.
        const g = guard(APP_ORIGIN);

        expect(() =>
            g.canActivate(contextWith({ origin: `${APP_ORIGIN}.evil.test` }))
        ).toThrow(ForbiddenException);
        expect(() =>
            g.canActivate(contextWith({ origin: 'https://evil.test' }))
        ).toThrow(ForbiddenException);
    });

    it('refuses every origin when the allow-list is empty', () => {
        expect(() =>
            guard().canActivate(contextWith({ origin: APP_ORIGIN }))
        ).toThrow(ForbiddenException);
    });

    it('honours every entry when several origins are allowed', () => {
        const g = guard('https://a.example.com', 'https://b.example.com');

        expect(
            g.canActivate(contextWith({ origin: 'https://b.example.com' }))
        ).toBe(true);
    });
});
