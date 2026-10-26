import { buildSuggestions, type SuggestionContentType } from './suggestions';

const ARTICLES: SuggestionContentType = {
    name: 'article',
    label: 'Articles',
    kind: 'collection',
    owned: true
};
const PRICING: SuggestionContentType = {
    name: 'pricing',
    label: 'Pricing FAQ',
    kind: 'single',
    owned: true
};
const SHARED_AUTHORS: SuggestionContentType = {
    name: 'author',
    label: 'Authors',
    kind: 'collection',
    owned: false
};

/** Every tool an editor is offered in a deployment with i18n and activity. */
const EDITOR_TOOLS = [
    'admin_content_types',
    'admin_content_search',
    'activity_recent',
    'content_propose_create',
    'content_propose_update',
    'content_propose_bulk_save',
    'i18n_propose_translation'
];

describe('buildSuggestions', () => {
    it('names the workspace’s own content and its manual skill', () => {
        expect(
            buildSuggestions({
                types: [SHARED_AUTHORS, ARTICLES, PRICING],
                skills: [
                    {
                        name: 'house-style',
                        title: 'House style',
                        mode: 'always'
                    },
                    {
                        name: 'seo-checklist',
                        title: 'SEO checklist',
                        mode: 'manual'
                    }
                ],
                tools: EDITOR_TOOLS
            })
        ).toEqual([
            { kind: 'missing-summary', type: ARTICLES },
            { kind: 'recent-changes' },
            { kind: 'translate', type: ARTICLES },
            {
                kind: 'check-skill',
                type: ARTICLES,
                skill: { name: 'seo-checklist', title: 'SEO checklist' }
            }
        ]);
    });

    it('offers a viewer reads only', () => {
        const suggestions = buildSuggestions({
            types: [ARTICLES],
            skills: [],
            tools: ['admin_content_types', 'admin_content_search']
        });

        expect(suggestions.map((suggestion) => suggestion.kind)).toEqual([
            'content-types'
        ]);
    });

    it('never suggests writing to a type the workspace only reads from a shared source', () => {
        const suggestions = buildSuggestions({
            types: [SHARED_AUTHORS],
            skills: [],
            tools: EDITOR_TOOLS
        });

        expect(
            suggestions.some(
                (suggestion) =>
                    suggestion.kind === 'missing-summary' ||
                    suggestion.kind === 'draft-new'
            )
        ).toBe(false);
    });

    it('ignores an always-on skill — it already applies to every chat', () => {
        const suggestions = buildSuggestions({
            types: [ARTICLES],
            skills: [
                { name: 'house-style', title: 'House style', mode: 'always' }
            ],
            tools: EDITOR_TOOLS
        });

        expect(suggestions.some((s) => s.kind === 'check-skill')).toBe(false);
    });

    it('fills the gaps without repeating itself, and stops at four', () => {
        const suggestions = buildSuggestions({
            types: [ARTICLES],
            skills: [],
            tools: [
                'admin_content_search',
                'content_propose_create',
                'content_propose_update'
            ]
        });

        expect(suggestions.map((s) => s.kind)).toEqual([
            'missing-summary',
            'draft-new',
            'content-types'
        ]);
        expect(
            buildSuggestions({
                types: [ARTICLES],
                skills: [{ name: 'seo', title: 'SEO', mode: 'manual' }],
                tools: EDITOR_TOOLS
            })
        ).toHaveLength(4);
    });

    it('still says something in a workspace with no content at all', () => {
        expect(buildSuggestions({ types: [], skills: [], tools: [] })).toEqual([
            { kind: 'content-types' }
        ]);
    });
});
