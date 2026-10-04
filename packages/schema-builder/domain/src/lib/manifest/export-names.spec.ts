import { joinExportName, tableExportName } from './export-names';

describe('manifest export names', () => {
    it.each([
        ['article', 'articleTable'],
        ['seo_meta', 'seoMetaTable'],
        ['site_settings2', 'siteSettings2Table']
    ])('%s → %s', (type, name) => {
        expect(tableExportName(type)).toBe(name);
    });

    it('names a join table after its type and field', () => {
        expect(joinExportName('master_collection', 'related')).toBe(
            'masterCollectionRelatedJoinTable'
        );
        expect(joinExportName('article', 'tags')).toBe('articleTagsJoinTable');
    });
});
