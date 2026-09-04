import { csvParser, csvSerializer } from './csv-format';
import { TransferParseError, type ParseContext } from './ports';
import type { TransferTypeSchema } from '../schema/type-schema';

const post: TransferTypeSchema = {
    name: 'post',
    publishable: true,
    paranoid: true,
    i18n: false,
    fields: [
        { name: 'title', type: 'text', required: true },
        { name: 'body', type: 'richtext', required: false },
        { name: 'views', type: 'number', required: false }
    ]
};

const context = (overrides: Partial<ParseContext> = {}): ParseContext => ({
    schemas: { post },
    identityFieldsOf: () => ['title'],
    defaultType: 'post',
    limits: { maxRecords: 100, maxColumns: 50 },
    ...overrides
});

/** A CSV whose header is exactly what the serializer would have written. */
function sheet(header: string, ...rows: string[]): string {
    return [header, ...rows].join('\r\n');
}

describe('csvParser column checking', () => {
    // The control. Every rejection below is only meaningful if the same file
    // with a correct header actually imports — otherwise the parser could be
    // refusing everything and the assertions would not know.
    it('reads a file whose header names only fields the type has', () => {
        const document = csvParser.parse(
            [
                {
                    path: 'post.csv',
                    text: sheet(
                        '$id,title,body,views',
                        'row-1,Hello,Some words,7'
                    )
                }
            ],
            context()
        );

        expect(document.records).toHaveLength(1);
        expect(document.records[0].values).toMatchObject({
            title: 'Hello',
            views: 7
        });
    });

    it('refuses a header column the type does not have, and names it [transfer:I-30]', () => {
        // The whole point of the rule: `titel` is a typo for `title`, and
        // skipping it quietly would drop a column of edited copy while the
        // import reported success. The column has real content in it here, so
        // "the data was thrown away" is exactly what the refusal prevents.
        expect(() =>
            csvParser.parse(
                [
                    {
                        path: 'post.csv',
                        text: sheet('$id,titel,views', 'row-1,Hello,7')
                    }
                ],
                context()
            )
        ).toThrow(/column\(s\) this type doesn't have: titel/);
    });

    it('names every unknown column, not just the first [transfer:I-30]', () => {
        expect(() =>
            csvParser.parse(
                [
                    {
                        path: 'post.csv',
                        text: sheet(
                            '$id,title,copyright,translator',
                            'row-1,Hello,(c) 2026,Ada'
                        )
                    }
                ],
                context()
            )
        ).toThrow(/copyright, translator/);
    });

    it('rejects rather than skips — nothing is parsed out of the file [transfer:I-30]', () => {
        // A "quiet skip" implementation would return this record with `title`
        // populated and `note` dropped. Asserting the throw *type* rather than
        // just any error is what keeps this from passing on an unrelated crash.
        let thrown: unknown;
        try {
            csvParser.parse(
                [
                    {
                        path: 'post.csv',
                        text: sheet('title,note', 'Hello,a stray column')
                    }
                ],
                context()
            );
        } catch (error) {
            thrown = error;
        }

        expect(thrown).toBeInstanceOf(TransferParseError);
    });

    it('accepts the five envelope columns, which belong to no type', () => {
        const document = csvParser.parse(
            [
                {
                    path: 'post.csv',
                    text: sheet(
                        '$id,$depth,$locale,$localeGroup,$status,title',
                        'row-1,0,en,group-1,published,Hello'
                    )
                }
            ],
            context()
        );

        expect(document.records).toHaveLength(1);
    });

    it('refuses a file named after a type this installation does not have', () => {
        expect(() =>
            csvParser.parse(
                [{ path: 'widget.csv', text: sheet('title', 'Hello') }],
                context({ defaultType: undefined })
            )
        ).toThrow(/"widget", which this installation doesn't have/);
    });
});

describe('csvSerializer', () => {
    it('writes one file per type, named for the type', () => {
        const document = {
            manifest: {
                version: 1,
                exportedAt: new Date(0).toISOString(),
                sourceWorkspaceId: '',
                rootType: 'post',
                depth: {
                    relations: false,
                    media: false,
                    locales: false,
                    relationLocales: false
                },
                identity: { post: ['title'] },
                counts: { roots: 1, related: 0, assets: 0, assetBytes: 0 }
            },
            records: [
                {
                    $type: 'post',
                    $id: 'row-1',
                    $key: { title: 'Hello' },
                    $depth: 0 as const,
                    values: { title: 'Hello', views: 7 },
                    relations: {},
                    media: []
                }
            ]
        };

        const files = csvSerializer.serialize(document, context());

        expect(files.map((file) => file.path)).toEqual(['post.csv']);
        expect(files[0].text.split('\r\n')[0]).toBe(
            '$id,$depth,$locale,$localeGroup,$status,title,body,views'
        );
    });

    it('refuses to lay out a type it has no schema for', () => {
        // Skipping it would hand back a file that looks complete.
        const document = {
            manifest: {
                version: 1,
                exportedAt: new Date(0).toISOString(),
                sourceWorkspaceId: '',
                rootType: 'widget',
                depth: {
                    relations: false,
                    media: false,
                    locales: false,
                    relationLocales: false
                },
                identity: {},
                counts: { roots: 1, related: 0, assets: 0, assetBytes: 0 }
            },
            records: [
                {
                    $type: 'widget',
                    $id: 'row-1',
                    $key: {},
                    $depth: 0 as const,
                    values: {},
                    relations: {},
                    media: []
                }
            ]
        };

        expect(() => csvSerializer.serialize(document, context())).toThrow(
            /No schema for content type "widget"/
        );
    });
});
