import { describe, expect, it } from 'vitest';
import { roleChanges } from '.';

/** Trimmed copies of the seeded grants — enough keys to decide every row. */
const CONTRIBUTOR = [
    'content:read',
    'content:update',
    'content:publish',
    'users:read',
    'workspaces:read'
];
const ADMIN = [
    ...CONTRIBUTOR,
    'users:update',
    'tokens:create',
    'webhooks:manage',
    'workspaces:create',
    'workspaces:update'
];
const VIEWER = ['content:read', 'users:read', 'workspaces:read'];

describe('roleChanges', () => {
    it('marks what promotion to admin adds, and keeps what stays', () => {
        expect(roleChanges(CONTRIBUTOR, ADMIN)).toEqual([
            { id: 'editContent', before: true, after: true, changed: false },
            { id: 'manageMembers', before: false, after: true, changed: true },
            {
                id: 'tokensAndWebhooks',
                before: false,
                after: true,
                changed: true
            },
            {
                id: 'manageWorkspaces',
                before: false,
                after: true,
                changed: true
            }
        ]);
    });

    it('marks what a demotion takes away', () => {
        const rows = roleChanges(CONTRIBUTOR, VIEWER);
        expect(rows[0]).toEqual({
            id: 'editContent',
            before: true,
            after: false,
            changed: true
        });
        expect(rows.slice(1).every((row) => !row.changed)).toBe(true);
    });

    it('needs every key of a capability, not one of them', () => {
        // Publishing without editing is not "edit and publish".
        const rows = roleChanges(VIEWER, [...VIEWER, 'content:publish']);
        expect(rows[0].after).toBe(false);
    });
});
