import { validateToolInput } from './validate-tool-input';

const SEARCH_SCHEMA = {
    type: 'object',
    properties: {
        typeName: { type: 'string', minLength: 1 },
        search: { type: 'string', maxLength: 255 },
        page: { type: 'integer', minimum: 1 },
        sort: { type: 'string', enum: ['updatedAt', '-updatedAt'] },
        fields: { type: 'array', items: { type: 'string' }, maxItems: 3 }
    },
    required: ['typeName'],
    additionalProperties: false
};

describe('validateToolInput', () => {
    it('accepts a valid call', () => {
        const result = validateToolInput(
            { typeName: 'article', search: 'launch', page: 2 },
            SEARCH_SCHEMA
        );

        expect(result).toEqual({ valid: true, errors: [] });
    });

    it('reports a missing required property', () => {
        const result = validateToolInput({ search: 'x' }, SEARCH_SCHEMA);

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('typeName: required');
    });

    it('reports a wrong type', () => {
        const result = validateToolInput({ typeName: 42 }, SEARCH_SCHEMA);

        expect(result.errors).toContain('typeName: expected string');
    });

    it('distinguishes integer from number', () => {
        expect(
            validateToolInput({ typeName: 'a', page: 1.5 }, SEARCH_SCHEMA)
                .errors
        ).toContain('page: expected integer');
        expect(
            validateToolInput({ typeName: 'a', page: 2 }, SEARCH_SCHEMA).valid
        ).toBe(true);
    });

    it('enforces enum membership', () => {
        const result = validateToolInput(
            { typeName: 'a', sort: 'title' },
            SEARCH_SCHEMA
        );

        expect(result.errors).toContain(
            'sort: must be one of updatedAt, -updatedAt'
        );
    });

    it('enforces numeric and length bounds', () => {
        expect(
            validateToolInput({ typeName: 'a', page: 0 }, SEARCH_SCHEMA).errors
        ).toContain('page: expected >= 1');
        expect(
            validateToolInput({ typeName: '' }, SEARCH_SCHEMA).errors
        ).toContain('typeName: expected at least 1 characters');
    });

    it('rejects an unexpected property when the schema is closed', () => {
        const result = validateToolInput(
            { typeName: 'a', dropTable: true },
            SEARCH_SCHEMA
        );

        expect(result.errors).toContain('dropTable: unexpected property');
    });

    it('accepts extra properties when the schema stays open', () => {
        const open = { type: 'object', properties: { a: { type: 'string' } } };

        expect(validateToolInput({ a: 'x', b: 1 }, open).valid).toBe(true);
    });

    it('validates array items and length', () => {
        expect(
            validateToolInput(
                { typeName: 'a', fields: ['x', 2] },
                SEARCH_SCHEMA
            ).errors
        ).toContain('fields[1]: expected string');

        expect(
            validateToolInput(
                { typeName: 'a', fields: ['a', 'b', 'c', 'd'] },
                SEARCH_SCHEMA
            ).errors
        ).toContain('fields: expected at most 3 items');
    });

    it('validates nested objects by path', () => {
        const nested = {
            type: 'object',
            properties: {
                filter: {
                    type: 'object',
                    properties: { field: { type: 'string' } },
                    required: ['field']
                }
            }
        };

        expect(validateToolInput({ filter: {} }, nested).errors).toContain(
            'filter.field: required'
        );
    });

    it('reports a non-object where an object is required', () => {
        expect(validateToolInput('nope', SEARCH_SCHEMA).errors).toEqual([
            'input: expected object'
        ]);
    });

    it('reports every problem, not just the first', () => {
        const result = validateToolInput({ page: 0, sort: 'x' }, SEARCH_SCHEMA);

        expect(result.errors.length).toBeGreaterThanOrEqual(3);
    });

    // Ignoring what it doesn't know is the documented contract — it is a
    // defence-in-depth check, not the security boundary.
    it('ignores schema keywords it does not implement', () => {
        const withUnknown = {
            type: 'object',
            properties: { a: { type: 'string', pattern: '^\\d+$' } }
        };

        expect(
            validateToolInput({ a: 'not-a-number' }, withUnknown).valid
        ).toBe(true);
    });
});
