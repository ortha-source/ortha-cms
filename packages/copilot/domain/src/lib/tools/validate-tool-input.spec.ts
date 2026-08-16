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

    // Pinned so the blast radius of that tolerance is written down rather than
    // rediscovered. A subschema whose only keyword is one of these validates
    // *nothing* — the value reaches the tool untouched. `content/server`'s
    // filter tree is a live instance (`filter-schema.ts` nests rules under
    // `items: { anyOf: [...] }`), and its own comment says so: the parser, not
    // this, is the boundary for a filter.
    describe('the subset it does not implement', () => {
        it.each([
            ['oneOf', { oneOf: [{ type: 'string' }, { type: 'number' }] }],
            ['anyOf', { anyOf: [{ type: 'string' }] }],
            ['allOf', { allOf: [{ type: 'string' }] }],
            ['$ref', { $ref: '#/$defs/Rule' }]
        ])('validates nothing under a bare %s subschema', (_label, schema) => {
            expect(
                validateToolInput({ anything: ['at', 'all'] }, schema).valid
            ).toBe(true);
        });

        // A recursive schema cannot be expressed, so `check` cannot recurse
        // forever — a genuine benefit of the subset rather than a gap.
        it('cannot recurse through $ref', () => {
            const selfReferential = {
                type: 'object',
                properties: { next: { $ref: '#' } }
            };

            expect(
                validateToolInput({ next: { next: {} } }, selfReferential).valid
            ).toBe(true);
        });
    });

    describe('inputs a provider can legitimately emit', () => {
        // The engine passes `call.input` straight through, and a provider may
        // emit `undefined` for a tool called with no arguments.
        it('reports a type error for undefined against an object schema', () => {
            expect(validateToolInput(undefined, { type: 'object' })).toEqual({
                valid: false,
                errors: ['input: expected object']
            });
        });

        // An empty schema constrains nothing. Worth pinning: a tool that ships
        // `{}` is choosing to validate in its own `run`.
        it('accepts anything against an empty schema', () => {
            expect(validateToolInput({ a: 1 }, {}).valid).toBe(true);
            expect(validateToolInput(undefined, {}).valid).toBe(true);
        });

        it('fails closed when `properties` is not an object', () => {
            const malformed = {
                type: 'object',
                properties: 'nope',
                additionalProperties: false
            };

            expect(validateToolInput({ a: 1 }, malformed).valid).toBe(false);
        });

        // Recursion follows the *schema*, not the value: a property with no
        // declared subschema is never descended into. So a model cannot blow
        // the stack by nesting its arguments, only by us authoring a schema
        // thousands of levels deep.
        it('does not recurse into undeclared properties, however deep', () => {
            let deep: Record<string, unknown> = { leaf: 1 };
            for (let i = 0; i < 50_000; i++) {
                deep = { n: deep };
            }

            expect(() =>
                validateToolInput(deep, { type: 'object' })
            ).not.toThrow();
        });
    });

    // All six bounds use `<`/`>`, so the boundary value itself is valid —
    // standard JSON Schema semantics, and an off-by-one here would silently
    // reject calls a tool documented as legal.
    it('treats every bound as inclusive', () => {
        expect(
            validateToolInput('ab', {
                type: 'string',
                minLength: 2,
                maxLength: 2
            }).valid
        ).toBe(true);
        expect(
            validateToolInput(5, { type: 'integer', minimum: 5, maximum: 5 })
                .valid
        ).toBe(true);
        expect(
            validateToolInput([1], { type: 'array', minItems: 1, maxItems: 1 })
                .valid
        ).toBe(true);
    });

    it.each([
        ['a fractional integer', 1.5, 'integer'],
        ['null as an integer', null, 'integer'],
        ['Infinity as a number', Infinity, 'number'],
        ['NaN as a number', NaN, 'number']
    ])('rejects %s', (_label, value, type) => {
        expect(validateToolInput(value, { type }).errors).toEqual([
            `input: expected ${type}`
        ]);
    });
});
