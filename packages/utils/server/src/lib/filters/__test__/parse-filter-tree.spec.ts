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

    describe('non-object input', () => {
        // Asserted directly rather than incidentally: `InvalidShape` is the
        // gate between "a filter" and "some other JSON value", and an array
        // slipping past it would reach `walkNode` as a node.
        const captureCode = (filter: unknown): string => {
            try {
                parseFilterTree(filter, schema);
            } catch (err) {
                return (err as { code: string }).code;
            }
            throw new Error('expected parseFilterTree to throw');
        };

        it('rejects an array, a JSON string and a JSON number', () => {
            expect(
                captureCode('[{"field":"email","op":"eq","value":"x"}]')
            ).toBe(FilterErrorCode.InvalidShape);
            expect(captureCode('"hello"')).toBe(FilterErrorCode.InvalidShape);
            expect(captureCode('42')).toBe(FilterErrorCode.InvalidShape);
            expect(captureCode('true')).toBe(FilterErrorCode.InvalidShape);
            expect(captureCode([])).toBe(FilterErrorCode.InvalidShape);
        });

        it('distinguishes the JS value `null` from the JSON text "null"', () => {
            // Only the former short-circuits at the top of the function. Over
            // HTTP `?filter=null` arrives as the four-character STRING, which
            // JSON-parses to `null` and then fails the shape check — a 400,
            // not the "200, unfiltered" a reader of the `rawFilter === null`
            // guard would predict. Pinned because the two look identical at
            // the call site and only one of them is reachable from a URL.
            expect(parseFilterTree(null, schema)).toBeNull();
            expect(captureCode('null')).toBe(FilterErrorCode.InvalidShape);
        });

        it('rejects a path-traversal-shaped field name', () => {
            // `'../../x'.split('.')` is `['','','/','/x']` — four segments, so
            // the depth cap catches it before the whitelist even runs. Either
            // way it is a 400; there is no filesystem semantics to escape into.
            expect(
                captureCode({ field: '../../x', op: 'eq', value: 'y' })
            ).toBe(FilterErrorCode.DepthExceeded);
            expect(captureCode({ field: '../x', op: 'eq', value: 'y' })).toBe(
                FilterErrorCode.UnknownRelation
            );
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

        it('still rejects unknown fields via the leaf resolver [utils:I-21]', () => {
            expect(
                captureCode({ field: 'secretField', op: 'eq', value: 'x' })
            ).toBe(FilterErrorCode.UnknownField);
        });

        it('still rejects unknown operators via the leaf resolver', () => {
            expect(
                captureCode({ field: 'id', op: 'totallybogus', value: UUID })
            ).toBe(FilterErrorCode.UnknownOperator);
        });

        it('accepts a canonical uuid value', () => {
            const tree = parseFilterTree(
                { field: 'id', op: 'eq', value: UUID },
                schema
            );
            expect(tree).toMatchObject({ kind: 'rule', value: UUID });
        });

        it('rejects a non-canonical uuid (only hex+dashes) with InvalidValue', () => {
            // The loose `[0-9a-f-]{36}` form would pass this and then fail
            // Postgres' uuid cast as a 500; the canonical regex rejects it 400.
            expect(
                captureCode({
                    field: 'id',
                    op: 'eq',
                    value: '------------------------------------'
                })
            ).toBe(FilterErrorCode.InvalidValue);
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

        it('rejects an empty `in` list (would match no rows) [utils:I-31]', () => {
            // An empty array reaches inArray(col, []) which Drizzle emits as
            // SQL `false`; reject it as a clean 400 instead.
            expect(captureCode({ field: 'status', op: 'in', value: [] })).toBe(
                FilterErrorCode.EmptyInList
            );
        });

        it('rejects an empty `nin` list (would match every row) [utils:I-31]', () => {
            // notInArray(col, []) emits SQL `true` — a silent inverted filter.
            expect(captureCode({ field: 'status', op: 'nin', value: [] })).toBe(
                FilterErrorCode.EmptyInList
            );
        });

        it('caps the `in` value list length', () => {
            const tinySchema: FilterSchema = {
                ...schema,
                maxInListLength: 3
            };
            try {
                parseFilterTree(
                    {
                        field: 'email',
                        op: 'in',
                        value: ['a', 'b', 'c', 'd']
                    },
                    tinySchema
                );
                throw new Error('expected parseFilterTree to throw');
            } catch (err) {
                expect((err as { code: string }).code).toBe(
                    FilterErrorCode.MaxInListExceeded
                );
            }
        });

        it('accepts an `in` list within the cap', () => {
            const tree = parseFilterTree(
                {
                    field: 'status',
                    op: 'in',
                    value: ['active', 'pending']
                },
                schema
            );
            expect(tree).toMatchObject({
                kind: 'rule',
                op: 'in',
                value: ['active', 'pending']
            });
        });
    });

    describe('at-limit boundaries', () => {
        // Each cap had only its reject side covered, so an off-by-one that
        // rejected the last legal filter would have passed the suite.
        const rule = { field: 'email', op: 'eq', value: 'a@b.com' };

        const captureCode = (filter: unknown, s: FilterSchema): string => {
            try {
                parseFilterTree(filter, s);
            } catch (err) {
                return (err as { code: string }).code;
            }
            throw new Error('expected parseFilterTree to throw');
        };

        it('accepts exactly `maxNodes` nodes and rejects one more', () => {
            // The group itself counts as a node, so `maxNodes: 5` admits four
            // children.
            const tinySchema: FilterSchema = { ...schema, maxNodes: 5 };
            expect(
                parseFilterTree(
                    { and: Array.from({ length: 4 }, () => rule) },
                    tinySchema
                )
            ).toMatchObject({ kind: 'group', combinator: 'and' });
            expect(
                captureCode(
                    { and: Array.from({ length: 5 }, () => rule) },
                    tinySchema
                )
            ).toBe(FilterErrorCode.MaxNodesExceeded);
        });

        it('accepts exactly `maxGroupDepth` nested groups and rejects one more', () => {
            // The check is `depth >= maxGroupDepth` counting from 0 at the
            // root, so five nested groups are the maximum.
            const nest = (n: number) => {
                let inner: unknown = rule;
                for (let i = 0; i < n; i++) inner = { and: [inner] };
                return inner;
            };
            const schemaWithRoom: FilterSchema = { ...schema, maxNodes: 100 };
            expect(parseFilterTree(nest(5), schemaWithRoom)).toBeTruthy();
            expect(captureCode(nest(6), schemaWithRoom)).toBe(
                FilterErrorCode.GroupDepthExceeded
            );
        });

        it('accepts exactly `maxDepth` path segments and rejects one more', () => {
            // `path.length > maxDepth`, so `a.b.c` passes at the default 3.
            const deepSchema: FilterSchema = {
                maxDepth: 2,
                relations: {
                    workspaces: {
                        kind: 'many-to-many',
                        through: {} as never,
                        fk: {} as never,
                        targetFk: {} as never,
                        table: {} as never,
                        fields: { name: { type: 'string' } },
                        relations: {
                            owner: {
                                kind: 'many-to-one',
                                table: {} as never,
                                fk: {} as never,
                                fields: { name: { type: 'string' } }
                            }
                        }
                    }
                }
            };
            expect(
                parseFilterTree(
                    { field: 'workspaces.name', op: 'eq', value: 'x' },
                    deepSchema
                )
            ).toMatchObject({ path: ['workspaces', 'name'] });
            expect(
                captureCode(
                    { field: 'workspaces.owner.name', op: 'eq', value: 'x' },
                    deepSchema
                )
            ).toBe(FilterErrorCode.DepthExceeded);
        });
    });
});
