import { scopePermissions } from './api-token-scope';

describe('scopePermissions', () => {
    it('grants reading content and its media for a read token', () => {
        // `media:read` rides along because the public content reads hand back a
        // media field's assets as metadata plus a URL — withholding the bytes
        // from the token that just received the URL makes the metadata useless.
        expect(scopePermissions('read')).toEqual([
            'content:read',
            'media:read',
            // Reader entitlements decide which published entries a request sees
            // at all, so a token that cannot ask whether an entry is restricted
            // reports a partial list as the whole one. It reveals nothing new
            // about the content: the only entries whose access it can look up
            // are the ones it can already fetch.
            'segments:read'
        ]);
    });

    it('grants the full content CRUD set plus uploads for a full token', () => {
        expect(scopePermissions('full')).toEqual([
            'content:read',
            'content:create',
            'content:update',
            'content:publish',
            'content:delete',
            'media:read',
            'media:create',
            'segments:read',
            // Setting who may read a record is an entry-level editorial
            // decision of the same weight as publishing or deleting it. What it
            // does not open is the audience *vocabulary* — no token-facing
            // surface exposes the directory, so this key reaches entry access
            // and nothing else.
            'segments:manage'
        ]);
    });

    it('never lets a read token write', () => {
        const read = new Set(scopePermissions('read'));
        expect(read.has('content:create')).toBe(false);
        expect(read.has('content:update')).toBe(false);
        expect(read.has('content:publish')).toBe(false);
        expect(read.has('content:delete')).toBe(false);
        // Including uploads: a read token can fetch an asset, never add one.
        expect(read.has('media:create')).toBe(false);
        // …and never decides who may read one.
        expect(read.has('segments:manage')).toBe(false);
    });

    it('never lets any token curate the media library', () => {
        // Attaching an asset to a record is content authoring; renaming or
        // deleting somebody else's library asset is administration, and nothing
        // on the public API needs it.
        for (const scope of ['read', 'full'] as const) {
            const granted = new Set(scopePermissions(scope));
            expect(granted.has('media:update')).toBe(false);
            expect(granted.has('media:delete')).toBe(false);
        }
    });
});
