import { diffDocuments } from '@orthacms/schema-builder-domain';
import {
    article,
    author,
    entry,
    envelopeOf,
    typeDoc
} from '../../../testing/document';
import { schemaDraft } from './index';

const doc = envelopeOf([article, author]).document;
const fieldsOf = (d: typeof doc, type: string) =>
    d.types.find((t) => t.name === type)?.fields ?? [];

describe('schemaDraft', () => {
    it('resets to a document', () => {
        expect(
            schemaDraft(doc, {
                type: 'reset',
                document: envelopeOf([]).document
            }).types
        ).toEqual([]);
    });

    it('adds, updates and removes a type', () => {
        const added = schemaDraft(doc, {
            type: 'type.add',
            doc: typeDoc({ name: 'venue', origin: 'new' })
        });
        expect(added.types.map((t) => t.name)).toEqual([
            'article',
            'author',
            'venue'
        ]);
        const labelled = schemaDraft(added, {
            type: 'type.update',
            name: 'venue',
            patch: { label: 'Venues' }
        });
        expect(labelled.types[2].label).toBe('Venues');
        expect(
            schemaDraft(labelled, { type: 'type.remove', name: 'venue' }).types
        ).toHaveLength(2);
    });

    it('renames a new type and carries the relations that named it along', () => {
        const renamed = schemaDraft(doc, {
            type: 'type.update',
            name: 'author',
            patch: { name: 'writer' }
        });
        expect(renamed.types.map((t) => t.name)).toEqual(['article', 'writer']);
        expect(
            fieldsOf(renamed, 'article').find((f) => f.name === 'author')?.spec
        ).toMatchObject({ to: 'writer' });
    });

    it('adds, updates and removes a field — keeping its key, so a rename stays a rename', () => {
        const added = schemaDraft(doc, {
            type: 'field.add',
            typeName: 'author',
            entry: entry('author', 'bio', { type: 'richtext' })
        });
        expect(fieldsOf(added, 'author').map((f) => f.name)).toEqual([
            'name',
            'bio'
        ]);
        const renamed = schemaDraft(doc, {
            type: 'field.update',
            typeName: 'author',
            key: 'author.name',
            name: 'fullName',
            spec: { type: 'text', required: true }
        });
        expect(fieldsOf(renamed, 'author')[0]).toEqual({
            key: 'author.name',
            name: 'fullName',
            spec: { type: 'text', required: true }
        });
        expect(diffDocuments(doc, renamed).map((c) => c.kind)).toEqual([
            'field.rename',
            'field.update'
        ]);
        expect(
            fieldsOf(
                schemaDraft(doc, {
                    type: 'field.remove',
                    typeName: 'article',
                    key: 'article.kind'
                }),
                'article'
            )
        ).toHaveLength(5);
    });

    it('moves a field to where another one is, by key', () => {
        const moved = schemaDraft(doc, {
            type: 'field.move',
            typeName: 'article',
            key: 'article.kind',
            before: 'article.body'
        });
        expect(fieldsOf(moved, 'article').map((f) => f.name)).toEqual([
            'kind',
            'body',
            'title',
            'author',
            'cover',
            'slug'
        ]);
        expect(diffDocuments(doc, moved).map((c) => c.kind)).toEqual([
            'field.reorder'
        ]);
    });

    it('ignores a move to or from a key that is not there', () => {
        expect(
            schemaDraft(doc, {
                type: 'field.move',
                typeName: 'article',
                key: 'nope',
                before: 'article.body'
            })
        ).toEqual(doc);
    });

    it('sets the groups, and draws a field whose group went loose again', () => {
        const ungrouped = schemaDraft(doc, {
            type: 'groups.set',
            typeName: 'article',
            groups: []
        });
        expect(ungrouped.types[0].groups).toEqual([]);
        expect(
            fieldsOf(ungrouped, 'article').find((f) => f.name === 'slug')?.spec
                .admin
        ).toEqual({});
        const relabelled = schemaDraft(doc, {
            type: 'groups.set',
            typeName: 'article',
            groups: [{ key: 'seo', label: 'Search' }]
        });
        expect(
            fieldsOf(relabelled, 'article').find((f) => f.name === 'slug')?.spec
                .admin
        ).toEqual({ group: 'seo' });
    });
});
