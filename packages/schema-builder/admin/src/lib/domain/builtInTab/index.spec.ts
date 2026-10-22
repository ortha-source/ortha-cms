import { article } from '../../../testing/document';
import { fieldsOnTab } from './index';

describe('fieldsOnTab', () => {
    it('puts every field on the one form, relations and media included, in declaration order', () => {
        expect(fieldsOnTab(article, 'general').map((f) => f.name)).toEqual(
            article.fields.map((f) => f.name)
        );
        expect(fieldsOnTab(article, 'general').map((f) => f.spec.type)).toEqual(
            expect.arrayContaining(['relation', 'media'])
        );
    });
});
