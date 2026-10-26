import { PERMISSIONS, SYSTEM_ROLES } from '@orthacms/identity-server';
import { RoleCatalogController } from './role-catalog.controller';

/**
 * `GET /api/users/roles` feeds the role dialog's "what changes" table. Its
 * whole value is that it says what the guard enforces, so it is asserted
 * against identity's matrix rather than against a copy of it.
 */
describe('RoleCatalogController', () => {
    const { items } = new RoleCatalogController().list();

    it('answers exactly the three assignable roles', () => {
        expect(items.map((role) => role.key)).toEqual([
            'admin',
            'contributor',
            'viewer'
        ]);
    });

    it('carries each role’s grants verbatim from SYSTEM_ROLES', () => {
        for (const role of items) {
            const source = SYSTEM_ROLES.find((r) => r.key === role.key);
            expect(role.permissions).toEqual([...(source?.permissions ?? [])]);
        }
    });

    it('gives admin the member-management grant the others lack', () => {
        const grants = (key: string) =>
            items.find((role) => role.key === key)?.permissions ?? [];
        expect(grants('admin')).toContain(PERMISSIONS.USERS_UPDATE);
        expect(grants('contributor')).not.toContain(PERMISSIONS.USERS_UPDATE);
        expect(grants('viewer')).not.toContain(PERMISSIONS.CONTENT_UPDATE);
    });
});
