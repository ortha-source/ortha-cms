import type { ContentField, ContentTypeDetail, EntryRecord } from '../../types/contentType';

/**
 * How many mock rows each collection gets. Enough to exercise multiple pages at
 * the default page size without being slow to generate.
 */
const MOCK_ENTRY_COUNT = 37;

/** A handful of lorem words to build deterministic text values from. */
const WORDS = [
    'launch',
    'roadmap',
    'design',
    'preview',
    'release',
    'beta',
    'insight',
    'signal',
    'draft',
    'sketch',
    'vision',
    'update',
    'summary',
    'guide',
    'note'
];

/** Stable 32-bit hash of a string — the seed source for a row's values. */
function hash(input: string): number {
    let h = 2166136261;
    for (let i = 0; i < input.length; i++) {
        h ^= input.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

/** A deterministic 0..1 generator (mulberry32) seeded by a number. */
function rng(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
        s |= 0;
        s = (s + 0x6d2b79f5) | 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** A deterministic UUID-shaped id from a seed, so ids look real but are stable. */
function fakeId(seed: number): string {
    const next = rng(seed);
    const hex = (n: number) =>
        Math.floor(next() * 16 ** n)
            .toString(16)
            .padStart(n, '0');
    return `${hex(8)}-${hex(4)}-${hex(4)}-${hex(4)}-${hex(8)}${hex(4)}`;
}

/** A deterministic ISO timestamp within roughly the last year, from a seed. */
function fakeDate(seed: number): string {
    const dayMs = 24 * 60 * 60 * 1000;
    const daysAgo = Math.floor(rng(seed)() * 365);
    return new Date(Date.now() - daysAgo * dayMs).toISOString();
}

/** A deterministic value for one field, derived from a per-cell seed. */
function valueFor(field: ContentField, seed: number): unknown {
    const next = rng(seed);
    const pick = <T>(items: readonly T[]): T =>
        items[Math.floor(next() * items.length)];

    switch (field.type) {
        case 'text':
        case 'richtext': {
            const count = field.type === 'richtext' ? 8 : 3;
            return Array.from({ length: count }, () => pick(WORDS)).join(' ');
        }
        case 'number':
            return Math.floor(next() * 1000);
        case 'money':
            // Stored as minor units (cents), matching the server's `money` field.
            return Math.floor(next() * 100000);
        case 'boolean':
            return next() > 0.5;
        case 'date':
            return fakeDate(seed).slice(0, 10);
        case 'datetime':
            return fakeDate(seed);
        case 'select':
            return field.options && field.options.length > 0
                ? pick(field.options)
                : null;
        case 'media':
            return fakeId(seed);
        case 'json':
            return { sample: pick(WORDS), n: Math.floor(next() * 10) };
        case 'relation': {
            const label = `${pick(WORDS)} ${pick(WORDS)}`;
            if (field.relation?.many) {
                const n = 1 + Math.floor(next() * 3);
                return Array.from(
                    { length: n },
                    (_, i) => `${pick(WORDS)} ${i + 1}`
                );
            }
            return label;
        }
        default:
            return null;
    }
}

/**
 * Deterministically generate the mock entry list for a collection from its
 * schema. Values are seeded from the type name + row index + field name, so the
 * same collection always renders the same rows (stable across reloads and
 * paging). This is the only place that fabricates entries — when the real
 * `GET /api/content/:typeName` lands, `useContentEntries` swaps to it and this
 * util can be deleted.
 */
export function mockEntries(schema: ContentTypeDetail): EntryRecord[] {
    return Array.from({ length: MOCK_ENTRY_COUNT }, (_, index) => {
        const rowSeed = hash(`${schema.name}:${index}`);
        const values: Record<string, unknown> = {};
        for (const field of schema.fields) {
            values[field.name] = valueFor(
                field,
                hash(`${schema.name}:${index}:${field.name}`)
            );
        }
        return {
            id: fakeId(rowSeed),
            status: rowSeed % 3 === 0 ? 'draft' : 'published',
            createdAt: fakeDate(rowSeed ^ 0x9e3779b9),
            updatedAt: fakeDate(rowSeed),
            values
        };
    });
}
