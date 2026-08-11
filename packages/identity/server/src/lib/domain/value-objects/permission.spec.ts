import { InvalidPermissionError } from '../errors';
import { PERMISSION_KEYS } from '../../rbac/system-roles';
import { Permission } from './permission';

describe('Permission', () => {
    describe('create', () => {
        it('accepts a `resource:action` key', () => {
            expect(Permission.create('workspaces:read').value).toBe(
                'workspaces:read'
            );
        });

        it('accepts an underscored action', () => {
            expect(Permission.create('content:bulk_publish').value).toBe(
                'content:bulk_publish'
            );
        });

        it('accepts a `resource:sub_resource:action` key', () => {
            expect(Permission.create('copilot:skills:manage').value).toBe(
                'copilot:skills:manage'
            );
        });

        it.each([
            '',
            'workspaces',
            'Workspaces:read',
            'workspaces:',
            ':read',
            'a:b:c:d',
            'workspaces read',
            'workspaces:read '
        ])('rejects %p', (value) => {
            expect(() => Permission.create(value)).toThrow(
                InvalidPermissionError
            );
        });

        // The guard builds a Permission for every key a route requires, so a
        // catalogue entry the shape rejects is a 500 on that route — the bug
        // `copilot:skills:manage` shipped with. Fail here instead.
        it.each(PERMISSION_KEYS)('accepts the seeded key %p', (key) => {
            expect(() => Permission.create(key)).not.toThrow();
        });
    });

    describe('equals', () => {
        it('is structural on the key', () => {
            expect(
                Permission.create('users:read').equals(
                    Permission.create('users:read')
                )
            ).toBe(true);
            expect(
                Permission.create('users:read').equals(
                    Permission.create('users:create')
                )
            ).toBe(false);
        });
    });
});
