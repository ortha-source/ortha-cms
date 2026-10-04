import { InvalidDocumentError } from '../../domain/errors';
import { assertShape } from './assert-shape';

describe('assertShape', () => {
    it('passes a document and refuses anything else with every problem', () => {
        expect(() => assertShape({ version: 1, types: [] })).not.toThrow();
        try {
            assertShape({ version: 1, types: [{}] });
            throw new Error('expected a refusal');
        } catch (error) {
            expect(error).toBeInstanceOf(InvalidDocumentError);
            expect((error as InvalidDocumentError).problems).toContain(
                'types[0].name is missing'
            );
        }
    });
});
