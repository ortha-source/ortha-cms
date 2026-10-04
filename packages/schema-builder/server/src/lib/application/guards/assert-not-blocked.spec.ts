import { classify, diffDocuments } from '@orthacms/schema-builder-domain';
import { documentOf, typeOf, withField } from '../../../testing/documents';
import { SchemaBlockedError } from '../../domain/errors';
import { assertNotBlocked } from './assert-not-blocked';

describe('assertNotBlocked', () => {
    const tag = typeOf(
        'tag',
        { name: { type: 'text' } },
        { publishable: false }
    );
    const facts = { rows: () => 2, grantedTo: () => 0, referencedBy: () => [] };
    const verdicts = (after: ReturnType<typeof documentOf>) =>
        classify(diffDocuments(documentOf(tag), after), { after, facts });

    it('passes a draft with nothing blocked', () => {
        expect(() =>
            assertNotBlocked(
                verdicts(documentOf(withField(tag, 'color', { type: 'text' })))
            )
        ).not.toThrow();
    });

    it('refuses with each blocked change and its reason', () => {
        const blocked = verdicts(
            documentOf(withField(tag, 'code', { type: 'text', required: true }))
        );
        try {
            assertNotBlocked(blocked);
            throw new Error('expected a refusal');
        } catch (error) {
            expect(error).toBeInstanceOf(SchemaBlockedError);
            expect((error as SchemaBlockedError).details()).toEqual({
                changes: [
                    {
                        id: 'field.add:tag.code',
                        reason: 'required-on-live-type'
                    }
                ]
            });
        }
    });
});
