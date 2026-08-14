import { AccessPolicy, type Actor } from './access-policy';
import { Permission } from './value-objects/permission';

/** An actor holding exactly the given permission keys. */
function actor(...keys: string[]): Actor {
    return { userId: 'actor-1', grantedPermissions: new Set(keys) };
}

describe('AccessPolicy', () => {
    const policy = new AccessPolicy();

    describe('can', () => {
        it('allows a permission the actor holds', () => {
            expect(
                policy.can(
                    actor('workspaces:read'),
                    Permission.create('workspaces:read')
                )
            ).toBe(true);
        });

        it('denies a permission the actor does not hold', () => {
            expect(
                policy.can(
                    actor('workspaces:read'),
                    Permission.create('workspaces:create')
                )
            ).toBe(false);
        });

        it('denies when the actor holds nothing', () => {
            expect(policy.can(actor(), Permission.create('content:read'))).toBe(
                false
            );
        });

        it('ignores an unrelated scope in v1 (global decision)', () => {
            expect(
                policy.can(
                    actor('content:read'),
                    Permission.create('content:read'),
                    { workspaceId: 'ws-1' }
                )
            ).toBe(true);
        });
    });

    describe('canAll', () => {
        it('requires every listed permission', () => {
            const held = actor('content:read', 'content:create');
            expect(
                policy.canAll(held, [
                    Permission.create('content:read'),
                    Permission.create('content:create')
                ])
            ).toBe(true);
            expect(
                policy.canAll(held, [
                    Permission.create('content:read'),
                    Permission.create('content:publish')
                ])
            ).toBe(false);
        });

        it('is vacuously allowed for an empty requirement', () => {
            expect(policy.canAll(actor(), [])).toBe(true);
        });
    });

    describe('canAny', () => {
        // The catalogue route this backs is read by two roles that share no
        // permission — a create-only role and an update-only one — so holding
        // exactly one of the listed keys has to be enough.
        it('allows an actor holding only one of the listed permissions', () => {
            const listed = [
                Permission.create('workspaces:create'),
                Permission.create('workspaces:update')
            ];
            expect(policy.canAny(actor('workspaces:create'), listed)).toBe(
                true
            );
            expect(policy.canAny(actor('workspaces:update'), listed)).toBe(
                true
            );
        });

        it('denies an actor holding none of them', () => {
            expect(
                policy.canAny(actor('workspaces:read'), [
                    Permission.create('workspaces:create'),
                    Permission.create('workspaces:update')
                ])
            ).toBe(false);
        });

        it('is vacuously allowed for an empty requirement, like canAll', () => {
            expect(policy.canAny(actor(), [])).toBe(true);
        });
    });
});

describe('Permission value object', () => {
    it('accepts a resource:action key', () => {
        expect(Permission.create('workspaces:create').value).toBe(
            'workspaces:create'
        );
    });

    it.each([
        ['empty', ''],
        ['no action', 'workspaces:'],
        ['no resource', ':create'],
        ['uppercase', 'Workspaces:Create'],
        ['spaces', 'workspaces create']
    ])('rejects a %s key', (_label, value) => {
        expect(() => Permission.create(value)).toThrow();
    });
});
