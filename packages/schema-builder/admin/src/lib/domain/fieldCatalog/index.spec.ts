import { describe, expect, it } from 'vitest';
import { FIELD_CAPABILITIES } from '../fieldCapabilities';
import { catalogEntry, FIELD_CATALOG } from './index';

describe('FIELD_CATALOG', () => {
    it('offers every DSL field type, each choice once', () => {
        const ids = FIELD_CATALOG.map((entry) => entry.id);
        expect(new Set(ids).size).toBe(ids.length);
        expect(new Set(FIELD_CATALOG.map((entry) => entry.type))).toEqual(
            new Set(Object.keys(FIELD_CAPABILITIES))
        );
    });

    it('starts each choice from a spec of its own type', () => {
        for (const entry of FIELD_CATALOG) {
            expect(entry.spec(['article']).type).toBe(entry.type);
        }
    });

    it('makes long text a rich-text field with the textarea widget the DSL already has [schema-builder:I-13]', () => {
        const spec = catalogEntry('longtext').spec([]);
        expect(spec).toEqual({
            type: 'richtext',
            admin: { widget: 'textarea' }
        });
        // Nothing the sheet could not have set itself.
        expect(FIELD_CAPABILITIES.richtext.widgets).toContain('textarea');
    });

    it('points a new relation at the first type, and falls back on an unknown id', () => {
        expect(catalogEntry('relation').spec(['author', 'tag'])).toEqual({
            type: 'relation',
            to: 'author'
        });
        expect(catalogEntry('nope').id).toBe('text');
    });
});
