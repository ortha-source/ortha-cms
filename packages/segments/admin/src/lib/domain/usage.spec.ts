import {
    deleteConsequences,
    entryHref,
    namedInFilter,
    recordsHref,
    usageGroups,
    USAGE_STATE,
    type WorkspaceUsageItem
} from './usage';

const item = (over: Partial<WorkspaceUsageItem> = {}): WorkspaceUsageItem => ({
    entryId: 'e1',
    typeSlug: 'article',
    typeLabel: 'Article',
    title: 'Enterprise pricing',
    locale: null,
    state: USAGE_STATE.Allow,
    trashed: false,
    workspaceId: 'ws_marketing',
    workspaceName: 'Marketing site',
    ...over
});

describe('namedInFilter', () => {
    it('is the query builder’s wire JSON: restricted to OR excluded, as is-one-of', () => {
        expect(JSON.parse(namedInFilter('seg-acme'))).toEqual({
            or: [
                { field: 'audienceAllowed', op: 'in', value: ['seg-acme'] },
                { field: 'audienceDenied', op: 'in', value: ['seg-acme'] }
            ]
        });
    });
});

describe('recordsHref', () => {
    it('opens one type’s records list in one workspace, filtered to the audience', () => {
        const href = recordsHref('ws_marketing', 'article', 'seg-acme');
        const url = new URL(href, 'http://admin.test');
        expect(url.pathname).toBe('/workspaces/ws_marketing/content/article');
        expect(JSON.parse(url.searchParams.get('filter') ?? '')).toEqual(
            JSON.parse(namedInFilter('seg-acme'))
        );
    });
});

describe('entryHref', () => {
    it('opens the entry’s editor in the workspace it was read from', () => {
        expect(entryHref(item())).toBe(
            '/workspaces/ws_marketing/content/article/e1'
        );
    });
});

describe('usageGroups', () => {
    it('counts one records list per workspace and type, largest first', () => {
        const groups = usageGroups([
            item({ entryId: 'a' }),
            item({ entryId: 'b', typeSlug: 'page', typeLabel: 'Page' }),
            item({ entryId: 'c', typeSlug: 'page', typeLabel: 'Page' }),
            item({
                entryId: 'd',
                workspaceId: 'ws_docs',
                workspaceName: 'Product docs'
            })
        ]);
        expect(
            groups.map((group) => [
                group.workspaceName,
                group.typeLabel,
                group.count
            ])
        ).toEqual([
            ['Marketing site', 'Page', 2],
            ['Marketing site', 'Article', 1],
            ['Product docs', 'Article', 1]
        ]);
    });

    it('has nothing to open when nothing names the audience', () => {
        expect(usageGroups([])).toEqual([]);
    });
});

describe('deleteConsequences', () => {
    it('splits the entries by the side that names the audience', () => {
        const allowed = item({ entryId: 'a' });
        const denied = item({ entryId: 'b', state: USAGE_STATE.Deny });
        expect(deleteConsequences([allowed, denied])).toEqual({
            allowed: [allowed],
            denied: [denied]
        });
    });
});
