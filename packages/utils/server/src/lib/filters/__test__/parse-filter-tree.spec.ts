import { FilterErrorCode } from '../filter-exceptions';
import { parseFilterTree } from '../parse-filter-tree';
import type { FilterSchema, ParsedGroup, ParsedNode } from '../types';

const schema: FilterSchema = {
    fields: {
        id: { type: 'uuid' },
        email: { type: 'string' },
        status: {
            type: 'enum',
            enumValues: ['active', 'inactive', 'pending']
        },
        age: { type: 'number' }
    },
    relations: {
        workspaces: {
            kind: 'many-to-many',
            through: {} as never,
            fk: {} as never,
            targetFk: {} as never,
            table: {} as never,
            fields: {
                id: { type: 'uuid' },
                name: { type: 'string' }
            }
        }
    }
};

const UUID = '11111111-1111-1111-1111-111111111111';

describe('parseFilterTree', () => {
    describe('empty / null input', () => {
        it('returns null for missing filter', () => {
            expect(parseFilterTree(undefined, schema)).toBeNull();
            expect(parseFilterTree(null, schema)).toBeNull();
        });

        it('returns null for an empty JSON string', () => {
            expect(parseFilterTree('', schema)).toBeNull();
            expect(parseFilterTree('   ', schema)).toBeNull();
        });
    });

    describe('JSON string input', () => {
        it('parses a JSON-encoded tree', () => {
            const tree = parseFilterTree(
                JSON.stringify({
                    or: [
                        { field: 'email', op: 'ilike', value: '%@a.com' },
                        { field: 'email', op: 'ilike', value: '%@b.com' }
                    ]
                }),
                schema
            ) as ParsedGroup;
            expect(tree.kind).toBe('group');
            expect(tree.combinator).toBe('or');
            expect(tree.children).toHaveLength(2);
        });

        it('throws InvalidJson on malformed JSON', () => {
            expect.assertions(1);
            try {
                parseFilterTree('{not json', schema);
            } catch (err) {
                expect((err as { code: string }).code).toBe(
                    FilterErrorCode.InvalidJson
                );
            }
        });
    });

    describe('tree shape', () => {
        it('parses a single rule at the root', () => {
            const tree = parseFilterTree(
                { field: 'email', op: 'ilike', value: '%@x' },
                schema
            ) as ParsedNode;
            expect(tree.kind).toBe('rule');
            if (tree.kind === 'rule') {
                expect(tree.path).toEqual(['email']);
                expect(tree.op).toBe('ilike');
                expect(tree.value).toBe('%@x');
            }
        });

        it('parses an AND group', () => {
            const tree = parseFilterTree(
                {
                    and: [
                        { field: 'email', op: 'ilike', value: '%@x' },
                        { field: 'age', op: 'gt', value: '21' }
                    ]
                },
                schema
            ) as ParsedGroup;
            expect(tree.combinator).toBe('and');
            expect(tree.children).toHaveLength(2);
        });

        it('parses an OR group', () => {
            const tree = parseFilterTree(
                {
                    or: [
                        { field: 'status', op: 'eq', value: 'active' },
                        { field: 'status', op: 'eq', value: 'pending' }
                    ]
                },
                schema
            ) as ParsedGroup;
            expect(tree.combinator).toBe('or');
        });

        it('parses nested AND-of-ORs', () => {
            const tree = parseFilterTree(
                {
                    and: [
                        { field: 'email', op: 'ilike', value: '%@acme.com' },
                        {
                            or: [
                                { field: 'status', op: 'eq', value: 'active' },
                                { field: 'status', op: 'eq', value: 'pending' }
                            ]
                        }
                    ]
                },
                schema
            ) as ParsedGroup;
            expect(tree.children).toHaveLength(2);
            const inner = tree.children[1] as ParsedGroup;
            expect(inner.kind).toBe('group');
            expect(inner.combinator).toBe('or');
            expect(inner.children).toHaveLength(2);
        });

        it('expands dotted field paths into segments', () => {
            const tree = parseFilterTree(
                { field: 'workspaces.name', op: 'ilike', value: 'X%' },
                schema
            );
            expect(tree).toMatchObject({
                kind: 'rule',
                path: ['workspaces', 'name'],
                op: 'ilike'
            });
        });

        it('reuses leaf coercion (number)', () => {
            const tree = parseFilterTree(
                { field: 'age', op: 'gt', value: '18' },
                schema
            );
            if (tree && tree.kind === 'rule') {
                expect(tree.value).toBe(18);
            } else {
                throw new Error('expected a rule');
            }
        });
    });

    describe('object input — empty + bracket-shaped legacy payloads', () => {
        it('returns null for an empty object', () => {
            expect(parseFilterTree({}, schema)).toBeNull();
        });

        it('rejects a bracket-shaped object as InvalidNode', () => {
            // The bracket grammar is not accepted: clients sending
            // `?filter[id][eq]=...` (which Express would decode into this
            // shape) get a 400 instead of a silent translation.
            try {
                parseFilterTree({ id: { eq: UUID } }, schema);
                throw new Error('expected throw');
            } catch (err) {
                expect((err as { code: string }).code).toBe(
                    FilterErrorCode.InvalidNode
                );
            }
        });
    });

    describe('error branches', () => {
        const captureCode = (filter: unknown): string => {
            try {
                parseFilterTree(filter, schema);
            } catch (err) {
                return (err as { code: string }).code;
            }
            throw new Error('expected parseFilterTree to throw');
        };

        it('rejects nodes with both `and` and `or`', () => {
            expect(captureCode({ and: [], or: [] })).toBe(
                FilterErrorCode.InvalidNode
            );
        });

        it('rejects when `and` is not an array', () => {
            expect(captureCode({ and: 'nope' })).toBe(
                FilterErrorCode.InvalidNode
            );
        });

        it('rejects rules with missing `field` inside a group', () => {
            // The root branch tolerates bracket-shaped objects, so we
            // exercise the rule validator inside a group where the
            // walker is unambiguously in tree mode.
            expect(captureCode({ and: [{ op: 'eq', value: 'x' }] })).toBe(
                FilterErrorCode.InvalidNode
            );
        });

        it('rejects rules with empty `field`', () => {
            expect(
                captureCode({
                    and: [{ field: '', op: 'eq', value: 'x' }]
                })
            ).toBe(FilterErrorCode.InvalidNode);
        });

        it('still rejects unknown fields via the leaf resolver', () => {
            expect(
                captureCode({ field: 'secretField', op: 'eq', value: 'x' })
            ).toBe(FilterErrorCode.UnknownField);
        });

        it('still rejects unknown operators via the leaf resolver', () => {
            expect(
                captureCode({ field: 'id', op: 'totallybogus', value: UUID })
            ).toBe(FilterErrorCode.UnknownOperator);
        });

        it('caps total node count', () => {
            const tinySchema: FilterSchema = { ...schema, maxNodes: 5 };
            const children = Array.from({ length: 10 }, () => ({
                field: 'email',
                op: 'eq',
                value: 'a@b.com'
            }));
            try {
                parseFilterTree({ and: children }, tinySchema);
                throw new Error('expected parseFilterTree to throw');
            } catch (err) {
                expect((err as { code: string }).code).toBe(
                    FilterErrorCode.MaxNodesExceeded
                );
            }
        });

        it('caps group nesting depth', () => {
            // Build a chain of AND-of-AND-of-AND… deeper than 5.
            let inner: unknown = {
                field: 'email',
                op: 'eq',
                value: 'a@b.com'
            };
            for (let i = 0; i < 10; i++) inner = { and: [inner] };
            expect(captureCode(inner)).toBe(FilterErrorCode.GroupDepthExceeded);
        });
    });
});
