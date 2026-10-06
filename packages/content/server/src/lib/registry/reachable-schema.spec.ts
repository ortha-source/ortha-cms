import { collection } from '../collection/define';
import { field } from '../fields';
import { ContentTypeRegistry } from './content-type-registry';
import type { SerializedContentType } from './content-type-registry';
import { scopeSerializedType } from './reachable-schema';

const author = collection('author', { fields: { name: field.text() } });
const tag = collection('tag', { fields: { name: field.text() } });
const article = collection('article', {
    publishable: true,
    fields: {
        title: field.text({ required: true }),
        author: field.relation({
            to: () => author,
            required: true,
            onDelete: 'restrict'
        }),
        tags: field.relation({ to: () => tag, many: true })
    }
});
/** Always live, so its required single relation is a `NOT NULL` column. */
const note = collection('note', {
    fields: {
        body: field.text(),
        author: field.relation({
            to: () => author,
            required: true,
            onDelete: 'restrict'
        })
    }
});

const registry = new ContentTypeRegistry([author, tag, article, note]);
const schemaOf = (name: string) =>
    registry.serialize(name) as SerializedContentType;
const names = (type: SerializedContentType) =>
    type.fields.map((spec) => spec.name);

describe('scopeSerializedType', () => {
    /**
     * The copilot read `author: required` off the raw schema in a workspace
     * never granted `author`, and refused to save a draft the server would
     * have accepted — the requirement is waived there.
     */
    it('drops a relation whose target the workspace cannot reach', () => {
        const scoped = scopeSerializedType(
            schemaOf('article'),
            new Set(['article', 'tag'])
        );

        expect(names(scoped)).toEqual(['title', 'tags']);
    });

    it('returns the schema untouched when every target is reachable', () => {
        const schema = schemaOf('article');

        expect(
            scopeSerializedType(schema, new Set(['article', 'author', 'tag']))
        ).toBe(schema);
    });

    /**
     * The one requirement the server never waives: on a non-publishable type
     * it is a `NOT NULL` FK, so hiding it would hide why every save is a 422.
     */
    it('keeps a required single relation that is a NOT NULL column', () => {
        const scoped = scopeSerializedType(schemaOf('note'), new Set(['note']));

        expect(names(scoped)).toEqual(['body', 'author']);
    });
});
