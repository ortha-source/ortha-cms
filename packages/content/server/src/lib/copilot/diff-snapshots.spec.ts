import type { SerializedContentType } from '../registry/content-type-registry';
import { diffSnapshots } from './diff-snapshots';

const type = {
    name: 'article',
    kind: 'collection',
    label: 'Articles',
    publishable: true,
    paranoid: false,
    i18n: false,
    fields: [
        {
            name: 'title',
            type: 'text',
            required: true,
            validation: {},
            admin: {}
        },
        {
            name: 'views',
            type: 'number',
            required: false,
            validation: {},
            admin: {}
        },
        {
            name: 'author',
            type: 'relation',
            required: false,
            validation: {},
            admin: {},
            relation: { to: 'author', many: false }
        },
        {
            name: 'tags',
            type: 'relation',
            required: false,
            validation: {},
            admin: {},
            relation: { to: 'tag', many: true }
        }
    ]
} as unknown as SerializedContentType;

const snapshot = (
    values: Record<string, unknown>,
    relations: Record<string, string[]> = {}
) => ({ values, relations });

describe('diffSnapshots', () => {
    it('reports only the changed fields, counting the rest', () => {
        const result = diffSnapshots(
            type,
            snapshot({ title: 'Before', views: 3 }),
            snapshot({ title: 'After', views: 3 })
        );

        expect(result.changes).toEqual([
            {
                field: 'title',
                type: 'text',
                isLinkSet: false,
                from: 'Before',
                to: 'After'
            }
        ]);
        // views, author, tags — a model gets nothing from forty unchanged rows
        // except a bigger prompt.
        expect(result.unchangedFields).toBe(3);
    });

    it('treats null, undefined and empty string as the same emptiness', () => {
        const result = diffSnapshots(
            type,
            snapshot({ title: null }),
            snapshot({ title: '' })
        );
        expect(result.changes).toEqual([]);
    });

    it('reports a field that was filled in from empty', () => {
        const result = diffSnapshots(
            type,
            snapshot({ title: null }),
            snapshot({ title: 'Now set' })
        );
        expect(result.changes).toHaveLength(1);
        expect(result.changes[0]).toMatchObject({ from: null, to: 'Now set' });
    });

    it('compares a join-backed relation as an ordered id list', () => {
        const result = diffSnapshots(
            type,
            snapshot({}, { tags: ['a', 'b'] }),
            snapshot({}, { tags: ['b', 'a'] })
        );

        // Order is data on the owning side — a reorder is a real change, the
        // same rule the admin's diff applies.
        expect(result.changes).toEqual([
            {
                field: 'tags',
                type: 'relation',
                isLinkSet: true,
                from: ['a', 'b'],
                to: ['b', 'a']
            }
        ]);
    });

    it('treats an absent link set as empty rather than as a change', () => {
        const result = diffSnapshots(type, snapshot({}), snapshot({}, {}));
        expect(result.changes).toEqual([]);
        expect(result.unchangedFields).toBe(4);
    });

    it('compares a single relation by its FK in values, not as a link set', () => {
        const result = diffSnapshots(
            type,
            snapshot({ author: 'author-1' }),
            snapshot({ author: 'author-2' })
        );
        expect(result.changes[0]).toMatchObject({
            field: 'author',
            isLinkSet: false,
            from: 'author-1',
            to: 'author-2'
        });
    });

    it('ignores keys the schema does not declare', () => {
        // A snapshot is an immutable record of an older shape, so a removed
        // field can legitimately still be in it. Diffing against the *current*
        // schema is what keeps the answer about fields that still exist.
        const result = diffSnapshots(
            type,
            snapshot({ title: 'Same', removedField: 'old' }),
            snapshot({ title: 'Same' })
        );
        expect(result.changes).toEqual([]);
    });
});
