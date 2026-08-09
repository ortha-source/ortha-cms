import { readRouteContext } from './readRouteContext';

describe('readRouteContext', () => {
    it('returns no workspace outside the workspace shell', () => {
        expect(readRouteContext('/workspaces', '')).toEqual({
            workspaceId: null,
            surface: 'chat'
        });
        expect(readRouteContext('/', '')).toMatchObject({ workspaceId: null });
    });

    it('reads the workspace id inside the shell', () => {
        expect(readRouteContext('/workspaces/ws-1/content', '')).toMatchObject({
            workspaceId: 'ws-1',
            surface: 'chat'
        });
    });

    it('reads the content type from a records list', () => {
        expect(
            readRouteContext('/workspaces/ws-1/content/article', '')
        ).toEqual({
            workspaceId: 'ws-1',
            contentType: 'article',
            surface: 'records'
        });
    });

    it('reads the entry id from the editor', () => {
        expect(
            readRouteContext('/workspaces/ws-1/content/article/entry-9', '')
        ).toEqual({
            workspaceId: 'ws-1',
            contentType: 'article',
            entryId: 'entry-9',
            surface: 'entry'
        });
    });

    it('ignores the trailing tab segment', () => {
        expect(
            readRouteContext(
                '/workspaces/ws-1/content/article/entry-9/media',
                ''
            )
        ).toMatchObject({ entryId: 'entry-9', surface: 'entry' });
    });

    // Sending `entryId: "new"` would have the copilot confidently discuss an
    // entry that does not exist.
    it('does not treat `new` as an entry id', () => {
        const context = readRouteContext(
            '/workspaces/ws-1/content/article/new',
            ''
        );

        expect(context.entryId).toBeUndefined();
        expect(context.surface).toBe('records');
    });

    it('does not treat `trash` as an entry id', () => {
        expect(
            readRouteContext('/workspaces/ws-1/content/article/trash', '')
                .entryId
        ).toBeUndefined();
    });

    it('reads the locale from the query string', () => {
        expect(
            readRouteContext(
                '/workspaces/ws-1/content/article/entry-9',
                '?locale=de'
            )
        ).toMatchObject({ locale: 'de', entryId: 'entry-9' });
    });

    it('omits the locale when the query has none', () => {
        expect(
            readRouteContext('/workspaces/ws-1/content/article', '?page=2')
        ).not.toHaveProperty('locale');
    });

    it('reads a workspace-shell route that is not the content library', () => {
        expect(
            readRouteContext('/workspaces/ws-1/media', '')
        ).toEqual({ workspaceId: 'ws-1', surface: 'chat' });
    });
});
