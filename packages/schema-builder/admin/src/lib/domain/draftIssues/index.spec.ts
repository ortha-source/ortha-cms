import { entry, typeDoc } from '../../../testing/document';
import { draftIssues, fieldIssues, typeIssues } from './index';

describe('draftIssues', () => {
    const doc = {
        version: 1 as const,
        types: [
            typeDoc({
                name: 'post',
                fields: [
                    entry('post', 'id', { type: 'text' }),
                    entry('post', 'title', { type: 'text', localized: true })
                ]
            }),
            typeDoc({
                name: 'tag',
                fields: [entry('tag', 'name', { type: 'text' })]
            })
        ]
    };
    const issues = draftIssues(doc);

    it('reports every issue the kernel rules find', () => {
        expect(issues.map((issue) => issue.code).sort()).toEqual([
            'field.localized-without-i18n',
            'field.reserved-column'
        ]);
    });

    it('files them by type and by field', () => {
        expect(typeIssues(issues, 'post')).toHaveLength(2);
        expect(typeIssues(issues, 'tag')).toEqual([]);
        expect(
            fieldIssues(issues, 'post', 'title').map((issue) => issue.code)
        ).toEqual(['field.localized-without-i18n']);
    });
});
