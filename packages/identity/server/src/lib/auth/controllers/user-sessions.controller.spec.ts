import 'reflect-metadata';
import { UserSessionsController } from './user-sessions.controller';
import { PERMISSIONS_KEY } from '../../rbac/decorators/require-permissions.decorator';
import { PERMISSIONS } from '../../rbac/system-roles';

/** The `@RequirePermissions(...)` keys a handler carries. */
function requiredOn(handler: unknown): unknown {
    return Reflect.getMetadata(PERMISSIONS_KEY, handler as object);
}

/**
 * `UserSessionsController` — the permission metadata, asserted as data.
 *
 * This is not a formality. A session row carries the member's IP address and
 * `User-Agent` — where a colleague works from and what they work on — which is
 * surveillance data, not the directory data `users:read` grants. `users:read`
 * is held by **every** system role, `viewer` included, so gating the list on it
 * let any signed-in account read any other member's whereabouts
 * (BUG-identity-server-04). The fix was a one-word edit to a decorator, and a
 * one-word edit is exactly what regresses silently: nothing else in the suite
 * fails if `USERS_UPDATE` becomes `USERS_READ` again, because the route keeps
 * working — for more people than it should.
 *
 * Read straight off the prototype with `Reflect.getMetadata`, so it costs no
 * DI container and no HTTP.
 */
describe('UserSessionsController permission metadata', () => {
    it('gates listing a member’s sessions on users:update, not the weaker users:read [identity:I-16]', () => {
        expect(requiredOn(UserSessionsController.prototype.list)).toEqual([
            PERMISSIONS.USERS_UPDATE
        ]);
        expect(requiredOn(UserSessionsController.prototype.list)).not.toContain(
            PERMISSIONS.USERS_READ
        );
    });

    it('gates revoking one of a member’s sessions on users:update', () => {
        expect(requiredOn(UserSessionsController.prototype.revoke)).toEqual([
            PERMISSIONS.USERS_UPDATE
        ]);
    });

    it('asks the same permission of the read as of the write', () => {
        // Deliberate: reading where somebody works from is not a lesser act
        // than ending one of their sessions.
        expect(requiredOn(UserSessionsController.prototype.list)).toEqual(
            requiredOn(UserSessionsController.prototype.revoke)
        );
    });
});
