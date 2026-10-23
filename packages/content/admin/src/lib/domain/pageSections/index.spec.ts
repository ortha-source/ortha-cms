import type { ContentField } from '../types/contentType';
import { BASICS_SECTION, pageSections } from './index';

const field = (name: string, group?: string): ContentField =>
    ({
        name,
        type: 'text',
        required: false,
        localized: false,
        admin: group ? { group } : {}
    }) as unknown as ContentField;

describe('pageSections', () => {
    it('leads with Basics, then the sections in declaration order', () => {
        const sections = pageSections(
            [field('title'), field('seo', 'meta'), field('hero', 'media')],
            [
                { key: 'media', label: 'Media', collapsed: false },
                { key: 'meta', label: 'Meta', collapsed: false }
            ]
        );
        expect(sections.map((section) => section.key)).toEqual([
            BASICS_SECTION,
            'media',
            'meta'
        ]);
        expect(sections[0].fields).toEqual(['title']);
        expect(sections[2]).toEqual({
            key: 'meta',
            label: 'Meta',
            fields: ['seo']
        });
    });

    it('has no Basics when every field is in a section', () => {
        const sections = pageSections(
            [field('seo', 'meta')],
            [{ key: 'meta', label: 'Meta', collapsed: false }]
        );
        expect(sections.map((section) => section.key)).toEqual(['meta']);
    });
});
