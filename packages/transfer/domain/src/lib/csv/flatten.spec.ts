import {
    csvColumns,
    formatRefToken,
    parseRefToken,
    recordToRow,
    rowToRecord
} from './flatten';
import type { TransferRecord } from '../document/transfer-document';
import type { TransferTypeSchema } from '../schema/type-schema';

const post: TransferTypeSchema = {
    name: 'post',
    publishable: true,
    paranoid: true,
    i18n: false,
    fields: [
        { name: 'title', type: 'text', required: true },
        { name: 'views', type: 'number', required: false },
        { name: 'tags', type: 'multiselect', required: false },
        {
            name: 'author',
            type: 'relation',
            required: false,
            relation: { to: 'author', many: false }
        },
        {
            name: 'related',
            type: 'relation',
            required: false,
            relation: { to: 'post', many: true }
        },
        {
            name: 'backlinks',
            type: 'relation',
            required: false,
            // Inverse: owns no storage, so it must not become a column.
            relation: { to: 'post', many: true, inverse: { field: 'related' } }
        },
        { name: 'cover', type: 'media', required: false }
    ]
};

const identityFieldsOf = (type: string): string[] =>
    type === 'author' ? ['email'] : ['title'];

describe('csvColumns', () => {
    it('leads with the envelope and skips the inverse relation [transfer:I-05]', () => {
        expect(csvColumns(post)).toEqual([
            '$id',
            '$depth',
            '$locale',
            '$localeGroup',
            '$status',
            'title',
            'views',
            'tags',
            'author',
            'related',
            'cover'
        ]);
    });
});

describe('ref tokens', () => {
    it('round-trips a plain reference', () => {
        const token = formatRefToken(
            { $type: 'author', $key: { email: 'jane@example.com' } },
            ['email']
        );

        expect(token).toBe('author:jane@example.com');
        expect(parseRefToken(token, identityFieldsOf)).toEqual({
            $type: 'author',
            $key: { email: 'jane@example.com' }
        });
    });

    it('splits on the first colon so a key may contain one', () => {
        // A URL or a timestamp in a key value is ordinary; the type name is the
        // only part that cannot hold a colon.
        const parsed = parseRefToken('post:https://x.test/a', identityFieldsOf);
        expect(parsed).toEqual({
            $type: 'post',
            $key: { title: 'https://x.test/a' }
        });
    });

    it('escapes the separators inside a key value', () => {
        const ref = { $type: 'post', $key: { title: 'a;b|c\\d' } };
        const token = formatRefToken(ref, ['title']);

        expect(parseRefToken(token, identityFieldsOf)).toEqual(ref);
    });

    it('falls back to the source id when the type has no identity fields', () => {
        const token = formatRefToken(
            { $type: 'blob', $id: 'row-1', $key: {} },
            []
        );

        expect(token).toBe('blob:row-1');
        expect(parseRefToken(token, () => [])).toEqual({
            $type: 'blob',
            $id: 'row-1',
            $key: {}
        });
    });

    it('ignores a blank token', () => {
        expect(parseRefToken('   ', identityFieldsOf)).toBeUndefined();
    });
});

describe('recordToRow / rowToRecord', () => {
    const record: TransferRecord = {
        $type: 'post',
        $id: 'row-1',
        $key: { title: 'Hello' },
        $depth: 0,
        $status: 'published',
        values: { title: 'Hello', views: 12, tags: ['news', 'ru'] },
        relations: {
            author: { $type: 'author', $key: { email: 'jane@example.com' } },
            related: [
                { $type: 'post', $key: { title: 'Other' } },
                { $type: 'post', $key: { title: 'Third' } }
            ]
        },
        media: [
            {
                field: 'cover',
                $id: 'asset-1',
                name: 'cover.jpg',
                mimeType: 'image/jpeg',
                size: 10,
                url: 'https://x.test/cover.jpg'
            }
        ]
    };

    it('writes relations as ref tokens and media as a name list', () => {
        const columns = csvColumns(post);
        const row = recordToRow(record, post, identityFieldsOf);
        const cell = (name: string): string => row[columns.indexOf(name)];

        expect(cell('author')).toBe('author:jane@example.com');
        expect(cell('related')).toBe('post:Other;post:Third');
        expect(cell('cover')).toBe('https://x.test/cover.jpg');
        expect(cell('tags')).toBe('news;ru');
    });

    it('reads the row back with scalars and relations intact', () => {
        const columns = csvColumns(post);
        const row = recordToRow(record, post, identityFieldsOf);
        const parsed = rowToRecord(row, columns, post, identityFieldsOf);

        expect(parsed.values).toEqual({
            title: 'Hello',
            views: 12,
            tags: ['news', 'ru']
        });
        expect(parsed.relations['author']).toEqual({
            $type: 'author',
            $key: { email: 'jane@example.com' }
        });
        expect(parsed.relations['related']).toHaveLength(2);
        expect(parsed.$status).toBe('published');
    });

    it('does not reconstruct media — a filename in a cell is not a file [transfer:I-31]', () => {
        const columns = csvColumns(post);
        const row = recordToRow(record, post, identityFieldsOf);

        // Inventing an asset reference from a name would relink records to
        // whatever happened to share it.
        expect(rowToRecord(row, columns, post, identityFieldsOf).media).toEqual(
            []
        );
    });

    it('keeps an emptied single relation as an explicit null', () => {
        const columns = csvColumns(post);
        const row = recordToRow(
            { ...record, relations: { author: null, related: [] } },
            post,
            identityFieldsOf
        );

        expect(
            rowToRecord(row, columns, post, identityFieldsOf).relations[
                'author'
            ]
        ).toBeNull();
    });
});
