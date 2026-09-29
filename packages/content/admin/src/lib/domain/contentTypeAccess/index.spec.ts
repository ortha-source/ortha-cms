import { describe, expect, it } from 'vitest';
import type { ContentType } from '../types/contentType';
import {
    accessOf,
    reachableTypeNames,
    scopeContentTypes,
    sharedSourceGroups,
    sharedSourceOf,
    sourceChoiceScope,
    sourceChoices
} from '.';

const TRAVEL = { workspaceId: 'ws_travel', workspaceName: 'Travel Library' };
const BRAND = { workspaceId: 'ws_brand', workspaceName: 'Brand hub' };

const type = (name: string, access?: ContentType['access']): ContentType => ({
    name,
    kind: 'collection',
    label: name,
    access
});

describe('contentTypeAccess', () => {
    it('reads an absent access as own-only', () => {
        expect(accessOf(type('tag'))).toEqual({ own: true, sharedSources: [] });
    });

    it('keeps own-granted, shared-only and both; drops the unreachable', () => {
        const scoped = scopeContentTypes(
            [
                type('post', { own: true, sharedSources: [] }),
                type('tag', { own: false, sharedSources: [TRAVEL] }),
                type('author', { own: true, sharedSources: [TRAVEL] }),
                type('page', { own: false, sharedSources: [] })
            ],
            ['post', 'author']
        );
        expect(scoped.map((t) => [t.name, t.access?.own])).toEqual([
            ['post', true],
            ['tag', false],
            ['author', true]
        ]);
    });

    it('needs an own grant as well as the server verdict for own access', () => {
        // An older server: every type reads as own, so the grants decide.
        const scoped = scopeContentTypes([type('post'), type('tag')], ['post']);
        expect(scoped.map((t) => t.name)).toEqual(['post']);
    });

    it('groups types by source, a type under every source it comes from', () => {
        const groups = sharedSourceGroups([
            type('tag', { own: false, sharedSources: [TRAVEL, BRAND] }),
            type('author', { own: true, sharedSources: [TRAVEL] })
        ]);
        expect(
            groups.map((g) => [
                g.source.workspaceName,
                g.types.map((t) => t.name)
            ])
        ).toEqual([
            ['Travel Library', ['tag', 'author']],
            ['Brand hub', ['tag']]
        ]);
    });

    it('resolves a source only where the type is reached from it', () => {
        const tag = type('tag', { own: false, sharedSources: [TRAVEL] });
        expect(sharedSourceOf(tag, 'ws_travel')).toEqual(TRAVEL);
        expect(sharedSourceOf(tag, 'ws_brand')).toBeUndefined();
        expect(sharedSourceOf(tag, undefined)).toBeUndefined();
    });

    it('reaches own grants and available shared grants, not inert ones', () => {
        expect(
            reachableTypeNames({
                content: ['post'],
                sharedContent: [
                    { slug: 'tag', available: true },
                    { slug: 'page', available: false },
                    { slug: 'post', available: true }
                ]
            })
        ).toEqual(['post', 'tag']);
    });
});

describe('relation picker source choices', () => {
    it('offers own and each shared source by id', () => {
        expect(
            sourceChoices({ own: true, sharedSources: [TRAVEL, BRAND] })
        ).toEqual(['all', 'own', 'shared:ws_travel', 'shared:ws_brand']);
    });

    it('never offers "own" for a target reached only from shared workspaces', () => {
        expect(sourceChoices({ own: false, sharedSources: [TRAVEL] })).toEqual([
            'all',
            'shared:ws_travel'
        ]);
    });

    it('maps a choice to the list scope, keeping the named source', () => {
        expect(sourceChoiceScope('all')).toEqual({ scope: 'all' });
        expect(sourceChoiceScope('own')).toEqual({ scope: 'own' });
        expect(sourceChoiceScope('shared:ws_travel')).toEqual({
            scope: 'shared',
            workspaceId: 'ws_travel'
        });
    });
});
