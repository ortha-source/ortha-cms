import { classify, diffDocuments } from '@orthacms/schema-builder-domain';
import { documentOf, typeOf } from '../../../testing/documents';
import { UnconfirmedChangesError } from '../../domain/errors';
import { assertConfirmed } from './assert-confirmed';

describe('assertConfirmed [schema-builder:I-07]', () => {
    const tag = typeOf('tag', {
        name: { type: 'text' },
        a: { type: 'text' },
        b: { type: 'text' }
    });
    const after = documentOf({ ...tag, fields: [tag.fields[0]] });
    const facts = { rows: () => 0, grantedTo: () => 0, referencedBy: () => [] };
    const changes = classify(diffDocuments(documentOf(tag), after), {
        after,
        facts
    });

    it('passes when every destructive change is confirmed by its own id', () => {
        expect(() =>
            assertConfirmed(changes, [
                'field.remove:tag.a',
                'field.remove:tag.b'
            ])
        ).not.toThrow();
    });

    it('refuses, listing exactly the ones left unconfirmed', () => {
        try {
            assertConfirmed(changes, ['field.remove:tag.a']);
            throw new Error('expected a refusal');
        } catch (error) {
            expect(error).toBeInstanceOf(UnconfirmedChangesError);
            expect((error as UnconfirmedChangesError).changeIds).toEqual([
                'field.remove:tag.b'
            ]);
        }
    });

    it('has no "confirm all": a wildcard confirms nothing', () => {
        expect(() => assertConfirmed(changes, ['*', 'all'])).toThrow(
            UnconfirmedChangesError
        );
    });

    it('asks nothing of safe changes', () => {
        expect(() => assertConfirmed([], [])).not.toThrow();
    });
});
