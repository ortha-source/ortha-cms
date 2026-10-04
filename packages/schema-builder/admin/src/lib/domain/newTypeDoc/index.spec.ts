import { draftIssues } from '../draftIssues';
import { newTypeDoc } from './index';

describe('newTypeDoc', () => {
    it('makes a type the schema rules accept as it is', () => {
        const doc = {
            version: 1 as const,
            types: [
                newTypeDoc('event', 'Events', 'collection'),
                newTypeDoc('about_us', 'About', 'single')
            ]
        };
        expect(draftIssues(doc)).toEqual([]);
        expect(doc.types[1].path).toBe('/about-us');
        expect(doc.types[0]).toMatchObject({
            origin: 'new',
            label: 'Events',
            fields: [{ name: 'title' }]
        });
    });
});
