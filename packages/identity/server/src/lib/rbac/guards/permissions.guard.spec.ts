import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';
import { AccessPolicy } from '../../domain/access-policy';
import type { PublicUser } from '../../auth/services/auth.service';
import type { PermissionKey } from '../system-roles';
import { PERMISSIONS } from '../system-roles';
import type { PermissionsService } from '../services/permissions.service';
import {
    ANY_PERMISSION_KEY,
    PERMISSIONS_KEY
} from '../decorators/require-permissions.decorator';

/** Stand-in route handler — only its identity reaches the reflector. */
const handler = () => undefined;

const ROLE_ID = '55555555-5555-4555-8555-555555555555';

const USER: PublicUser = {
    id: '66666666-6666-4666-8666-666666666666',
    email: 'grace@example.com',
    name: 'Grace',
    roleId: ROLE_ID,
    status: 'active'
};

interface Options {
    /** `@RequirePermissions(...)` metadata, if the route carries any. */
    required?: PermissionKey[];
    /** `@RequireAnyPermission(...)` metadata, if the route carries any. */
    anyOf?: PermissionKey[];
    /** The permission keys the caller's role grants. */
    granted?: PermissionKey[];
    /** Set `false` to model a request the AuthGuard never touched. */
    withUser?: boolean;
}

interface Harness {
    guard: PermissionsGuard;
    context: ExecutionContext;
    policy: AccessPolicy;
    canAll: jest.SpyInstance;
    canAny: jest.SpyInstance;
    /** Every collaborator call, in order. */
    calls: string[];
}

function harness(options: Options = {}): Harness {
    const calls: string[] = [];

    const reflector = {
        getAllAndOverride: (key: string) => {
            calls.push(`getAllAndOverride(${key})`);
            if (key === PERMISSIONS_KEY) return options.required;
            if (key === ANY_PERMISSION_KEY) return options.anyOf;
            return undefined;
        }
    } as unknown as Reflector;

    const permissions = {
        forRole: async (roleId: string) => {
            calls.push(`forRole(${roleId})`);
            return options.granted ?? [];
        }
    } as unknown as PermissionsService;

    // The real policy, spied on: the point of the delegation test is that the
    // decision keeps coming from the unit-tested rule, not from a stand-in.
    const policy = new AccessPolicy();
    const canAll = jest.spyOn(policy, 'canAll');
    const canAny = jest.spyOn(policy, 'canAny');

    const request =
        options.withUser === false
            ? {}
            : ({ user: USER } as { user?: PublicUser });
    const context = {
        switchToHttp: () => ({ getRequest: () => request }),
        getHandler: () => handler,
        getClass: () => class Controller {}
    } as unknown as ExecutionContext;

    return {
        guard: new PermissionsGuard(reflector, permissions, policy),
        context,
        policy,
        canAll,
        canAny,
        calls
    };
}

/** The permission keys a spy call was asked about, as plain strings. */
function keysOf(call: unknown[]): string[] {
    return (call[1] as { value: string }[]).map((p) => p.value);
}

/**
 * `PermissionsGuard` — the wiring between an HTTP request and the pure RBAC
 * rule. It deliberately holds no policy of its own: it resolves the caller's
 * grants and hands the decision to {@link AccessPolicy}, so "what does this
 * permission set mean?" has exactly one answer across the session guard and the
 * bearer-token one.
 *
 * What this suite pins is the wiring's fail-closed behaviour, which is where a
 * guard actually goes wrong. An **unauthenticated** request must 403 rather
 * than throw on `undefined.id` — a crash reads as a 500 and, worse, a later
 * refactor that made the missing user merely falsy would sail straight through
 * the checks. And a route carrying both decorators must satisfy **both**: an
 * any-of list is a widening for one route, never a licence to skip the all-of
 * requirement standing next to it.
 */
describe('PermissionsGuard', () => {
    it('lets a route carrying no permission metadata through', async () => {
        // Authentication is still required — that is the AuthGuard's job — but
        // no *permission* is, so this must not consult roles at all.
        const { guard, context, calls } = harness();

        expect(await guard.canActivate(context)).toBe(true);
        expect(calls).toEqual([
            `getAllAndOverride(${PERMISSIONS_KEY})`,
            `getAllAndOverride(${ANY_PERMISSION_KEY})`
        ]);
    });

    it('treats empty decorator lists as no requirement', async () => {
        const { guard, context, calls } = harness({ required: [], anyOf: [] });

        expect(await guard.canActivate(context)).toBe(true);
        expect(calls).not.toContain(`forRole(${ROLE_ID})`);
    });

    it('denies a guarded route when no user was attached, rather than crashing', async () => {
        // The global AuthGuard attaches the user; a missing one means the route
        // was never authenticated. Deny — do not dereference it.
        const { guard, context, canAll } = harness({
            required: [PERMISSIONS.USERS_UPDATE],
            withUser: false
        });

        await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
            ForbiddenException
        );
        expect(canAll).not.toHaveBeenCalled();
    });

    it('allows a caller holding every required permission', async () => {
        const { guard, context, calls } = harness({
            required: [PERMISSIONS.USERS_READ, PERMISSIONS.USERS_UPDATE],
            granted: [PERMISSIONS.USERS_READ, PERMISSIONS.USERS_UPDATE]
        });

        expect(await guard.canActivate(context)).toBe(true);
        expect(calls).toContain(`forRole(${ROLE_ID})`);
    });

    it('denies a caller holding only some of the required permissions', async () => {
        const { guard, context } = harness({
            required: [PERMISSIONS.USERS_READ, PERMISSIONS.USERS_UPDATE],
            granted: [PERMISSIONS.USERS_READ]
        });

        await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
            ForbiddenException
        );
    });

    it('delegates the all-of decision to AccessPolicy, with the caller’s grants [identity:I-15]', async () => {
        const { guard, context, canAll, canAny } = harness({
            required: [PERMISSIONS.USERS_UPDATE],
            granted: [PERMISSIONS.USERS_UPDATE]
        });

        await guard.canActivate(context);

        expect(canAll).toHaveBeenCalledTimes(1);
        expect(canAny).not.toHaveBeenCalled();
        const [actor] = canAll.mock.calls[0];
        expect(actor).toEqual({
            userId: USER.id,
            grantedPermissions: new Set([PERMISSIONS.USERS_UPDATE])
        });
        expect(keysOf(canAll.mock.calls[0])).toEqual([
            PERMISSIONS.USERS_UPDATE
        ]);
    });

    it('delegates the any-of decision to AccessPolicy when only that decorator is present', async () => {
        const { guard, context, canAll, canAny } = harness({
            anyOf: [
                PERMISSIONS.WORKSPACES_CREATE,
                PERMISSIONS.WORKSPACES_UPDATE
            ],
            granted: [PERMISSIONS.WORKSPACES_UPDATE]
        });

        expect(await guard.canActivate(context)).toBe(true);
        expect(canAll).not.toHaveBeenCalled();
        expect(keysOf(canAny.mock.calls[0])).toEqual([
            PERMISSIONS.WORKSPACES_CREATE,
            PERMISSIONS.WORKSPACES_UPDATE
        ]);
    });

    it('requires both decorators to be satisfied when a route carries both', async () => {
        const both = {
            required: [PERMISSIONS.USERS_UPDATE],
            anyOf: [
                PERMISSIONS.WORKSPACES_CREATE,
                PERMISSIONS.WORKSPACES_UPDATE
            ]
        };

        const allowed = harness({
            ...both,
            granted: [PERMISSIONS.USERS_UPDATE, PERMISSIONS.WORKSPACES_UPDATE]
        });
        expect(await allowed.guard.canActivate(allowed.context)).toBe(true);
        expect(allowed.canAll).toHaveBeenCalledTimes(1);
        expect(allowed.canAny).toHaveBeenCalledTimes(1);

        // Holds the any-of, misses the all-of.
        const missingAll = harness({
            ...both,
            granted: [PERMISSIONS.WORKSPACES_UPDATE]
        });
        await expect(
            missingAll.guard.canActivate(missingAll.context)
        ).rejects.toBeInstanceOf(ForbiddenException);

        // Holds the all-of, misses every any-of.
        const missingAny = harness({
            ...both,
            granted: [PERMISSIONS.USERS_UPDATE]
        });
        await expect(
            missingAny.guard.canActivate(missingAny.context)
        ).rejects.toBeInstanceOf(ForbiddenException);
    });
});
