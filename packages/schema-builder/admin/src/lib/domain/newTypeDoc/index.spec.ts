import { draftIssues } from '../draftIssues';
import { newTypeDoc } from './index';

describe('newTypeDoc', () => {
    it('starts with no fields, which the schema rules hold against it until one is added', () => {
        const doc = {
            version: 1 as const,
            types: [
                newTypeDoc('event', 'Events', 'collection'),
                newTypeDoc('about_us', 'About', 'single')
            ]
        };
        expect(draftIssues(doc).map((issue) => issue.code)).toEqual([
            'type.no-fields',
            'type.no-fields'
        ]);
        expect(doc.types[1].path).toBe('/about-us');
        expect(doc.types[0]).toMatchObject({
            origin: 'new',
            label: 'Events',
            fields: []
        });
    });

    it('is accepted as it is once it has a field', () => {
        const type = newTypeDoc('event', 'Events', 'collection');
        const doc = {
            version: 1 as const,
            types: [
                {
                    ...type,
                    fields: [
                        {
                            key: 'new:1',
                            name: 'title',
                            spec: { type: 'text' as const }
                        }
                    ]
                }
            ]
        };
        expect(draftIssues(doc)).toEqual([]);
    });
});
