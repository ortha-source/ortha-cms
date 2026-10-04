import { checkColumn } from './check-column';

const type = {
    name: 'post',
    kind: 'collection' as const,
    i18n: false,
    fields: {}
};
const text = { type: 'text', required: false };

describe('checkColumn', () => {
    it.each(['status', 'createdAt', 'localeGroupId', 'id'])(
        'rejects %s, which lands in an envelope column',
        (name) => {
            const [found] = checkColumn(type, name, text, {
                columns: new Map()
            });
            expect(found.code).toBe('field.reserved-column');
            expect(found.message).toMatch(
                /collides with an envelope column\.$/
            );
        }
    );

    it('rejects a single relation landing on a reserved column', () => {
        const relation = {
            type: 'relation',
            required: false,
            relation: {
                to: 'x',
                many: false,
                unique: false,
                onDelete: 'set null' as const,
                syncAcrossLocales: true
            }
        };
        const [found] = checkColumn(type, 'workspace', relation, {
            columns: new Map()
        });
        expect(found.message).toBe(
            'Field "workspace" on "post" maps to column "workspace_id", which collides with an envelope column.'
        );
    });

    it('rejects two fields collapsing into one column, naming the first', () => {
        const pass = { columns: new Map<string, string>() };
        expect(checkColumn(type, 'readingTime', text, pass)).toEqual([]);
        const [found] = checkColumn(type, 'reading_time', text, pass);
        expect(found).toEqual({
            path: 'post.fields.reading_time',
            code: 'field.column-collision',
            message:
                'Fields "readingTime" and "reading_time" on "post" both map to column "reading_time".'
        });
    });

    it('ignores many-relations, which have no main-table column', () => {
        const many = {
            type: 'relation',
            required: false,
            relation: {
                to: 'tag',
                many: true,
                unique: false,
                onDelete: 'set null' as const,
                syncAcrossLocales: true
            }
        };
        expect(
            checkColumn(type, 'status', many, { columns: new Map() })
        ).toEqual([]);
    });
});
