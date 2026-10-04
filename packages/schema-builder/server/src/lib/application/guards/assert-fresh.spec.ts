import { documentOf, envelopeOf, typeOf } from '../../../testing/documents';
import { StaleDocumentError } from '../../domain/errors';
import { assertFresh } from './assert-fresh';

describe('assertFresh [schema-builder:I-06]', () => {
    const current = envelopeOf(
        documentOf(typeOf('post', { title: { type: 'text' } }))
    );

    it('passes a draft made against the served fingerprint', () => {
        expect(() => assertFresh(current, current.fingerprint)).not.toThrow();
    });

    it('refuses any other, naming the current fingerprint', () => {
        try {
            assertFresh(current, 'ffffffffffffffff');
            throw new Error('expected a refusal');
        } catch (error) {
            expect(error).toBeInstanceOf(StaleDocumentError);
            expect((error as StaleDocumentError).details()).toEqual({
                currentFingerprint: current.fingerprint
            });
        }
    });
});
