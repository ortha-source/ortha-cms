/**
 * In-memory relation candidates, keyed by target content-type name. **The only
 * mocked data in the relations feature** — there is no relation read API yet, so
 * the picker lists these instead of `GET /content/:type`. Each record mirrors the
 * `EntryRecord` wire shape (`id` + `values` bag, plus `status` on publishable
 * types) so swapping to the real endpoint later is a drop-in. Values are keyed by
 * the target type's real field names (see `apps/server/src/collections`), so the
 * query builder — fed the target's real schema — narrows them as it would live
 * rows. Ids are fixed (no random) so selections are stable across renders.
 *
 * `author` and `tag` are intentionally **large** (dozens of rows) so the picker's
 * lazy infinite scroll has something to page through; the rest stay small.
 */

/** One mocked candidate: the id, optional publish status, and its field values. */
export type MockCandidate = {
    id: string;
    status?: 'draft' | 'published';
    values: Record<string, unknown>;
};

/** A stable uuid-shaped id from a prefix + index (hex-safe, passes uuid validation). */
function mockId(prefix: string, index: number): string {
    const n = String(index).padStart(12, '0');
    return `${prefix}-${n.slice(0, 4)}-4a1b-8c2d-${n}`;
}

const TAG_WORDS = [
    'engineering',
    'design',
    'product',
    'research',
    'announcement',
    'tutorial',
    'guide',
    'release',
    'security',
    'performance',
    'accessibility',
    'culture',
    'hiring',
    'remote',
    'open-source',
    'frontend',
    'backend',
    'database',
    'devops',
    'testing',
    'mobile',
    'ai',
    'data',
    'ux',
    'marketing',
    'support',
    'community',
    'roadmap',
    'changelog',
    'beta',
    'launch',
    'retro'
];

const AUTHORS: readonly [string, string][] = [
    ['Ada', 'Lovelace'],
    ['Alan', 'Turing'],
    ['Grace', 'Hopper'],
    ['Katherine', 'Johnson'],
    ['Barbara', 'Liskov'],
    ['Donald', 'Knuth'],
    ['Edsger', 'Dijkstra'],
    ['Linus', 'Torvalds'],
    ['Margaret', 'Hamilton'],
    ['Tim', 'Berners-Lee'],
    ['Brendan', 'Eich'],
    ['Guido', 'van Rossum'],
    ['James', 'Gosling'],
    ['Anders', 'Hejlsberg'],
    ['Bjarne', 'Stroustrup'],
    ['Dennis', 'Ritchie'],
    ['Ken', 'Thompson'],
    ['John', 'McCarthy'],
    ['Rich', 'Hickey'],
    ['Yukihiro', 'Matsumoto'],
    ['Rasmus', 'Lerdorf'],
    ['Joe', 'Armstrong'],
    ['Robert', 'Martin'],
    ['Sandi', 'Metz']
];

const tagCandidates: readonly MockCandidate[] = TAG_WORDS.map((word, i) => ({
    id: mockId('b2e3d4c5', i + 1),
    values: { name: word, slug: word }
}));

const authorCandidates: readonly MockCandidate[] = AUTHORS.map(
    ([first, last], i) => ({
        id: mockId('a1f2c3d4', i + 1),
        values: {
            name: `${first} ${last}`,
            email: `${first.toLowerCase()}@example.com`,
            bio: `${first} ${last} — contributor #${i + 1}.`
        }
    })
);

/** Mocked candidates per target type name. An unknown type yields an empty list. */
export const MOCK_CANDIDATES: Record<string, readonly MockCandidate[]> = {
    author: authorCandidates,
    tag: tagCandidates,
    seo_meta: [
        {
            id: 'c3d4e5f6-0001-4c3d-ae4f-000000000001',
            values: {
                metaTitle: 'Getting started with Ortha',
                metaDescription: 'Learn the basics end to end.',
                canonicalUrl: 'https://example.com/getting-started'
            }
        },
        {
            id: 'c3d4e5f6-0002-4c3d-ae4f-000000000002',
            values: {
                metaTitle: 'Modeling relations',
                metaDescription: 'Wire collections together.',
                canonicalUrl: 'https://example.com/relations'
            }
        },
        {
            id: 'c3d4e5f6-0003-4c3d-ae4f-000000000003',
            values: {
                metaTitle: 'The publishing workflow',
                metaDescription: 'From draft to published.',
                canonicalUrl: 'https://example.com/publishing'
            }
        }
    ],
    comment: [
        {
            id: 'd4e5f6a7-0001-4d4e-bf50-000000000001',
            values: { author: 'Sam', body: 'This helped a lot, thanks!' }
        },
        {
            id: 'd4e5f6a7-0002-4d4e-bf50-000000000002',
            values: { author: 'Pat', body: 'Could the second part be clearer?' }
        },
        {
            id: 'd4e5f6a7-0003-4d4e-bf50-000000000003',
            values: { author: 'Jordan', body: 'Great write-up.' }
        }
    ],
    article: [
        {
            id: 'e5f6a7b8-0001-4e5f-c061-000000000001',
            status: 'published',
            values: { text: 'Getting started with Ortha', select: 'tutorial' }
        },
        {
            id: 'e5f6a7b8-0002-4e5f-c061-000000000002',
            status: 'draft',
            values: { text: 'Relations in depth', select: 'article' }
        },
        {
            id: 'e5f6a7b8-0003-4e5f-c061-000000000003',
            status: 'published',
            values: { text: 'Changelog 2.0', select: 'changelog' }
        }
    ]
};

/**
 * Look up one mocked candidate by target type + id, so an already-assigned
 * relation (an id with no loaded row) can still be labelled. Goes away with the
 * relation read API, like the rest of the mock.
 */
export function findMockCandidate(
    targetName: string,
    id: string
): MockCandidate | undefined {
    return (MOCK_CANDIDATES[targetName] ?? []).find(
        (candidate) => candidate.id === id
    );
}
