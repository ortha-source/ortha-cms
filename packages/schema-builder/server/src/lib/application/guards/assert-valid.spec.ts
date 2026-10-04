import { documentOf, typeOf } from '../../../testing/documents';
import { SchemaInvalidError } from '../../domain/errors';
import { assertValid } from './assert-valid';

describe('assertValid [schema-builder:I-10]', () => {
    it('passes a draft the DSL would accept', () => {
        expect(() =>
            assertValid(documentOf(typeOf('post', { title: { type: 'text' } })))
        ).not.toThrow();
    });

    it('refuses with every issue the kernel rules report, in their words', () => {
        const draft = documentOf(
            typeOf('post', { title: { type: 'text', localized: true } }),
            typeOf('post', {
                id: { type: 'text' },
                author: { type: 'relation', to: 'nobody' }
            })
        );
        try {
            assertValid(draft);
            throw new Error('expected a refusal');
        } catch (error) {
            expect(error).toBeInstanceOf(SchemaInvalidError);
            const codes = (error as SchemaInvalidError).issues.map(
                (issue) => issue.code
            );
            expect(codes.length).toBeGreaterThan(1);
            expect((error as SchemaInvalidError).message).toBe(
                (error as SchemaInvalidError).issues[0].message
            );
        }
    });
});
