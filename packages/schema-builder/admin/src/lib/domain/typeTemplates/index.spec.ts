import { draftIssues } from '../draftIssues';
import { newTypeDoc } from '../newTypeDoc';
import { TYPE_TEMPLATES } from './index';

describe('TYPE_TEMPLATES', () => {
    it.each(TYPE_TEMPLATES.filter((entry) => entry.id !== 'blank'))(
        'starts a type the schema rules accept: $id',
        (template) => {
            const doc = {
                version: 1 as const,
                types: [
                    newTypeDoc('thing', 'Things', 'collection', {
                        fields: template.fields()
                    })
                ]
            };
            expect(draftIssues(doc)).toEqual([]);
            expect(doc.types[0].fields.map((entry) => entry.name)).toEqual(
                template.names
            );
        }
    );

    it('gives every use fresh keys', () => {
        const [, article] = TYPE_TEMPLATES;
        const first = article.fields().map((entry) => entry.key);
        const second = article.fields().map((entry) => entry.key);
        expect(first.some((key) => second.includes(key))).toBe(false);
    });
});
