import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { AuthGuard } from './auth.guard';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import type { AuthService, PublicUser } from '../services/auth.service';
import type { CookieService } from '../services/cookie.service';

/** Stand-in route handler — only its identity reaches the reflector. */
const handler = () => undefined;

const TOKEN = 'c'.repeat(64);

const USER: PublicUser = {
    id: '33333333-3333-4333-8333-333333333333',
    email: 'ada@example.com',
    name: 'Ada',
    roleId: '44444444-4444-4444-8444-444444444444',
    status: 'active'
};

interface Options {
    /** What the reflector reports for `IS_PUBLIC_KEY`. */
    isPublic?: boolean;
    /** The cookie's session token, or `null` when there is no cookie. */
    token?: string | null;
    /** What `AuthService.currentUser` resolves the token to. */
    user?: PublicUser | null;
}

interface Harness {
    guard: AuthGuard;
    request: { user?: PublicUser };
    /** Every collaborator call, in order. */
    calls: string[];
    context: ExecutionContext;
}

function harness(options: Options = {}): Harness {
    const calls: string[] = [];
    const request: { user?: PublicUser } = {};

    const reflector = {
        getAllAndOverride: (key: string) => {
            calls.push(`getAllAndOverride(${key})`);
            return key === IS_PUBLIC_KEY ? options.isPublic : undefined;
        }
    } as unknown as Reflector;

    const cookies = {
        readSession: () => {
            calls.push('readSession()');
            return options.token === undefined ? TOKEN : options.token;
        }
    } as unknown as CookieService;

    const auth = {
        currentUser: async (sessionId: string) => {
            calls.push(`currentUser(${sessionId})`);
            return options.user === undefined ? USER : options.user;
        }
    } as unknown as AuthService;

    const context = {
        switchToHttp: () => ({ getRequest: () => request }),
        getHandler: () => handler,
        getClass: () => class Controller {}
    } as unknown as ExecutionContext;

    return {
        guard: new AuthGuard(reflector, auth, cookies),
        request,
        calls,
        context
    };
}

/**
 * `AuthGuard` — the app-wide gate. Registered as `APP_GUARD`, so it is what
 * makes "every route requires a session" true by default and `@Public()` the
 * only way out; a route nobody remembered to annotate stays protected, which is
 * the fail-closed direction.
 *
 * The two halves worth pinning: a public route must be decided **without
 * reading the cookie at all** (login has none, and resolving one would be a
 * pointless DB round-trip on the hottest anonymous path), and every way of
 * failing — no cookie, a token that resolves to nothing because the session was
 * revoked, expired, or belongs to a disabled account — must reach the caller as
 * the same bare 401, since anything finer is an oracle.
 *
 * Exercised over a hand-built `ExecutionContext` and test doubles: the guard's
 * job is the sequencing, and none of it needs a DI container.
 */
describe('AuthGuard', () => {
    it('lets a @Public() route through without reading the session cookie', async () => {
        const { guard, context, calls, request } = harness({ isPublic: true });

        expect(await guard.canActivate(context)).toBe(true);
        expect(calls).toEqual([`getAllAndOverride(${IS_PUBLIC_KEY})`]);
        expect(request.user).toBeUndefined();
    });

    it('rejects a request carrying no session cookie, without asking the auth service', async () => {
        const { guard, context, calls } = harness({ token: null });

        await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
            UnauthorizedException
        );
        expect(calls).toEqual([
            `getAllAndOverride(${IS_PUBLIC_KEY})`,
            'readSession()'
        ]);
    });

    it('rejects a cookie that no longer resolves to a user', async () => {
        // Revoked, expired, or the account was disabled — all indistinguishable
        // to the caller, all a bare 401.
        const { guard, context, request } = harness({ user: null });

        await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
            UnauthorizedException
        );
        expect(request.user).toBeUndefined();
    });

    it('attaches the resolved user to the request on success', async () => {
        const { guard, context, request, calls } = harness();

        expect(await guard.canActivate(context)).toBe(true);
        expect(request.user).toBe(USER);
        expect(calls).toEqual([
            `getAllAndOverride(${IS_PUBLIC_KEY})`,
            'readSession()',
            `currentUser(${TOKEN})`
        ]);
    });

    it('protects a route that carries no metadata at all', async () => {
        // The default has to be "guarded": a new controller nobody annotated
        // must not be open.
        const { guard, context } = harness({
            isPublic: undefined,
            token: null
        });

        await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
            UnauthorizedException
        );
    });
});
