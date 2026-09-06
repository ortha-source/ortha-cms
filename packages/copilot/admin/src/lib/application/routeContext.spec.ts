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
    // entry that does not exist — so the create form still carries no id. What
    // changed with ORT-203 is that it no longer *also* claims to be a records
    // list: it is its own surface, which is the only way the model can be told
    // the person is composing rather than browsing.
    it('reads the create form as its own surface, with no entry id [copilot:I-42]', () => {
        expect(
            readRouteContext('/workspaces/ws-1/content/article/new', '')
        ).toEqual({
            workspaceId: 'ws-1',
            contentType: 'article',
            surface: 'create'
        });
    });

    it('keeps the create surface on a tab of the create form', () => {
        expect(
            readRouteContext(
                '/workspaces/ws-1/content/article/new/relations',
                ''
            )
        ).toMatchObject({ surface: 'create' });
    });

    it('carries the locale onto the create form', () => {
        expect(
            readRouteContext(
                '/workspaces/ws-1/content/article/new',
                '?locale=de'
            )
        ).toMatchObject({ surface: 'create', locale: 'de' });
    });

    // Trash is not the create form's neighbour: it is a different set of the
    // same type's records, so it stays a records list.
    it('does not treat `trash` as an entry id or as the create form', () => {
        expect(
            readRouteContext('/workspaces/ws-1/content/article/trash', '')
        ).toEqual({
            workspaceId: 'ws-1',
            contentType: 'article',
            surface: 'records'
        });
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
        expect(readRouteContext('/workspaces/ws-1/media', '')).toEqual({
            workspaceId: 'ws-1',
            surface: 'chat'
        });
    });
});
