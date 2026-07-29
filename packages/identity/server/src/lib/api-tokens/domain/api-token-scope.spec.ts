import { scopePermissions } from './api-token-scope';

describe('scopePermissions', () => {
    it('grants only content:read for a read token', () => {
        expect(scopePermissions('read')).toEqual(['content:read']);
    });

    it('grants the full content CRUD set for a full token', () => {
        expect(scopePermissions('full')).toEqual([
            'content:read',
            'content:create',
            'content:update',
            'content:publish',
            'content:delete'
        ]);
    });

    it('never lets a read token write', () => {
        const read = new Set(scopePermissions('read'));
        expect(read.has('content:create')).toBe(false);
        expect(read.has('content:update')).toBe(false);
        expect(read.has('content:publish')).toBe(false);
        expect(read.has('content:delete')).toBe(false);
    });
});
