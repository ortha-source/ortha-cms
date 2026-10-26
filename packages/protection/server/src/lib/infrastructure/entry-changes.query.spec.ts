import { EntryChangesQuery } from './entry-changes.query';

const WS = 'ws-1';

/** Two fields, the way the registry serializes a type. */
const TYPE = {
    name: 'article',
    fields: [
        { name: 'title', type: 'text' },
        { name: 'price', type: 'number' }
    ]
};

const snapshot = (values: Record<string, unknown>) => ({
    values,
    relations: {}
});

function makeQuery(
    revisions: Record<number, Record<string, unknown>>,
    registered = true
) {
    const reads: number[] = [];
    const query = new EntryChangesQuery(
        {
            get: async (
                _type: string,
                _entry: string,
                _ws: string,
                number: number
            ) => {
                reads.push(number);
                const values = revisions[number];
                return values
                    ? { number, snapshot: snapshot(values) }
                    : undefined;
            }
        } as never,
        {
            serialize: (name: string) =>
                registered && name === 'article' ? TYPE : undefined
        } as never
    );
    return { query, reads };
}

describe('EntryChangesQuery', () => {
    it('counts the fields the head changed since the live version', async () => {
        const { query } = makeQuery({
            3: { title: 'Pricing questions', price: 29 },
            5: { title: 'Pricing FAQ', price: 29 }
        });
        expect(await query.fieldsChanged('article', 'e1', WS, 5, 3)).toBe(1);
    });

    it('counts every filled field of a never-published entry', async () => {
        const { query, reads } = makeQuery({
            1: { title: 'Draft', price: null }
        });
        // `null` → `null` is not a change: empties collapse, as in content.
        expect(await query.fieldsChanged('article', 'e1', WS, 1, null)).toBe(1);
        expect(reads).toEqual([1]);
    });

    it('reads nothing when the head is the live version', async () => {
        const { query, reads } = makeQuery({});
        expect(await query.fieldsChanged('article', 'e1', WS, 4, 4)).toBe(0);
        expect(reads).toEqual([]);
    });

    it('says nothing for a type that is no longer registered', async () => {
        const { query } = makeQuery({ 1: { title: 'x' } }, false);
        expect(
            await query.fieldsChanged('article', 'e1', WS, 1, null)
        ).toBeNull();
    });

    it('says nothing when a version it needs has gone', async () => {
        const { query } = makeQuery({ 5: { title: 'x' } });
        expect(await query.fieldsChanged('article', 'e1', WS, 5, 3)).toBeNull();
    });
});
