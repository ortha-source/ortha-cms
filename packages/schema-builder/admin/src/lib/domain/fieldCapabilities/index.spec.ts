import { describe, expect, it } from 'vitest';
import { catalogEntry } from '../fieldCatalog';
import { validationEditors } from './index';

describe('validationEditors', () => {
    it('offers rich text its length rules and the structure check', () => {
        expect(validationEditors(catalogEntry('richtext').spec([]))).toEqual([
            'length',
            'structure'
        ]);
    });

    it('offers long text no structure check — a plain box is not a document', () => {
        expect(validationEditors(catalogEntry('longtext').spec([]))).toEqual([
            'length'
        ]);
    });

    it('leaves every other kind to its type', () => {
        expect(validationEditors({ type: 'number' })).toEqual([
            'range',
            'integer'
        ]);
        expect(validationEditors({ type: 'boolean' })).toEqual([]);
    });
});
