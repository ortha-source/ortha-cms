import { article, entry, typeDoc } from '../../../testing/document';
import { generalTabLayout } from './index';

describe('generalTabLayout', () => {
    it('orders loose fields by control shape: inputs, choices, long text', () => {
        expect(generalTabLayout(article).loose.map((f) => f.name)).toEqual([
            'title',
            'kind',
            'body'
        ]);
    });

    it('keeps declaration order inside a group, whatever the ranks say', () => {
        const type = typeDoc({
            name: 't',
            groups: [{ key: 'g', label: 'G' }],
            fields: [
                entry('t', 'notes', {
                    type: 'richtext',
                    admin: { group: 'g' }
                }),
                entry('t', 'flag', { type: 'boolean', admin: { group: 'g' } }),
                entry('t', 'name', { type: 'text', admin: { group: 'g' } })
            ]
        });
        expect(
            generalTabLayout(type).groups[0].fields.map((f) => f.name)
        ).toEqual(['notes', 'flag', 'name']);
    });

    it('lists every group in order, empty ones included', () => {
        const type = typeDoc({
            name: 't',
            groups: [
                { key: 'b', label: 'B' },
                { key: 'a', label: 'A' }
            ],
            fields: [entry('t', 'x', { type: 'text', admin: { group: 'a' } })]
        });
        expect(
            generalTabLayout(type).groups.map(({ group, fields }) => [
                group.key,
                fields.length
            ])
        ).toEqual([
            ['b', 0],
            ['a', 1]
        ]);
    });

    it('draws a field naming an undeclared group loose, as the entry editor would', () => {
        const type = typeDoc({
            name: 't',
            fields: [
                entry('t', 'x', { type: 'text', admin: { group: 'ghost' } })
            ]
        });
        expect(generalTabLayout(type).loose.map((f) => f.name)).toEqual(['x']);
    });

    it('leaves relations and media out of General, grouped or not', () => {
        const type = typeDoc({
            name: 't',
            groups: [{ key: 'g', label: 'G' }],
            fields: [
                entry('t', 'r', {
                    type: 'relation',
                    to: 'x',
                    admin: { group: 'g' }
                }),
                entry('t', 'm', { type: 'media' })
            ]
        });
        const layout = generalTabLayout(type);
        expect(layout.loose).toEqual([]);
        expect(layout.groups[0].fields).toEqual([]);
    });
});
