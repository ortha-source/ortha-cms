import { getIntrospectionQuery, parse } from 'graphql';
import { DEFAULT_GRAPHQL_LIMITS } from '../../types/config';
import { checkLimits } from '../limits';

describe('checkLimits', () => {
    const check = (
        query: string,
        overrides: Partial<typeof DEFAULT_GRAPHQL_LIMITS> = {},
        variables: Record<string, unknown> = {},
        operationName?: string
    ) =>
        checkLimits(parse(query), operationName, variables, {
            ...DEFAULT_GRAPHQL_LIMITS,
            ...overrides
        });

    it('passes an ordinary query', () => {
        expect(
            check('{ articles(pageSize: 10) { items { id title } total } }')
        ).toEqual([]);
    });

    describe('depth', () => {
        it('refuses a query nested past the limit', () => {
            const errors = check('{ a { b { c { d { e } } } } }', {
                maxDepth: 3
            });

            expect(errors.map((error) => error.message)).toContainEqual(
                expect.stringMatching(/5 levels deep; the limit is 3/)
            );
            expect(errors[0].extensions['code']).toBe('GRAPHQL_LIMIT_EXCEEDED');
        });

        it('counts depth through a fragment spread', () => {
            // A cap that only looked at inline selections would be trivially
            // bypassed by moving the nesting into a fragment.
            const errors = check(
                `{ articles { ...deep } }
                 fragment deep on ArticleList { items { tags { items { id } } } }`,
                { maxDepth: 3 }
            );

            expect(errors.map((error) => error.message)).toContainEqual(
                expect.stringMatching(/levels deep/)
            );
        });

        it('survives a cyclic fragment rather than hanging', () => {
            // This runs BEFORE graphql-js validation rejects the cycle, so it
            // cannot assume a valid document.
            const errors = check(
                `{ articles { ...a } }
                 fragment a on ArticleList { ...b }
                 fragment b on ArticleList { ...a }`,
                { maxDepth: 3 }
            );

            expect(errors).toEqual([]);
        });
    });

    describe('field count', () => {
        it('refuses a document that aliases past the limit', () => {
            const aliased = Array.from(
                { length: 12 },
                (_, index) => `a${index}: articles { total }`
            ).join(' ');
            const errors = check(`{ ${aliased} }`, { maxFields: 10 });

            expect(errors[0].message).toMatch(/selects 24 fields/);
        });

        it('clears an ordinary document selecting a whole content type', () => {
            // The default used to be 30 *total* fields under the name
            // `maxAliases`, which refused a plain read of a thirty-field
            // content type — no alias in sight.
            const fields = Array.from(
                { length: 30 },
                (_, index) => `field${index}`
            ).join(' ');

            expect(
                check(`{ articles(pageSize: 5) { total items { ${fields} } } }`)
            ).toEqual([]);
        });
    });

    describe('introspection', () => {
        // Introspection is deliberately enabled, and it is answered from the
        // in-memory schema — no resolver, no database. Costing it against the
        // content budget refused the *standard* introspection query outright,
        // which is what GraphiQL and every codegen tool send.
        const introspection = getIntrospectionQuery();

        it('does not refuse the standard introspection query', () => {
            expect(check(introspection)).toEqual([]);
        });

        it('still costs the content fields alongside it', () => {
            const errors = check(
                `{ __schema { types { name } } articles(pageSize: 100) { items { tags(pageSize: 100) { items { id } } } } }`,
                { maxComplexity: 1000 }
            );

            expect(errors.map((error) => error.message)).toContainEqual(
                expect.stringMatching(/may touch about/)
            );
        });
    });

    describe('fragment expansion', () => {
        /**
         * `{ ...F0 }` with `F0 … F<levels-1>` each spreading the next ten
         * times. Non-cyclic, a few hundred bytes, and 10^levels expansions —
         * the shape that made the cost walk itself the denial of service.
         */
        const bomb = (levels: number): string => {
            const spread = (name: string) =>
                Array.from({ length: 10 }, () => `...${name}`).join(' ');
            let query = `{ ${spread('F0')} }\n`;
            for (let i = 0; i < levels; i++) {
                const body =
                    i === levels - 1
                        ? 'articles { total }'
                        : spread(`F${i + 1}`);
                query += `fragment F${i} on Query { ${body} }\n`;
            }
            return query;
        };

        it('costs a fragment bomb in linear time', () => {
            // 10^9 expansions. Un-memoised this blocked the event loop for
            // minutes on a ~800-byte document, taking every other request on
            // the process down with it.
            const document = bomb(9);
            expect(document.length).toBeLessThan(1000);

            const started = Date.now();
            const errors = check(document);

            expect(Date.now() - started).toBeLessThan(1000);
            expect(errors.map((error) => error.message)).toContainEqual(
                expect.stringMatching(/levels deep|selects \d+ fields/)
            );
        });

        it('counts a fragment spread twice as twice', () => {
            // Memoising must not turn N spreads into one.
            const once = check('{ ...f } fragment f on Query { a b c }', {
                maxFields: 2
            });
            const twice = check('{ ...f ...f } fragment f on Query { a b c }', {
                maxFields: 5
            });

            expect(once[0].message).toMatch(/selects 3 fields/);
            expect(twice[0].message).toMatch(/selects 6 fields/);
        });
    });

    describe('single-record locators', () => {
        it('costs a field addressed by id as one record', () => {
            // `article(id:) { author tags translations }` costs
            // 20 + 3 × (20 × 20) = 1220 if the parent counts as a full page —
            // refused at the default 1000 for a read that can touch 61 rows.
            expect(
                check(
                    '{ article(id: "x") { author { name } tags { items { name } } translations { locale } } }'
                )
            ).toEqual([]);
        });

        it('still costs the list form of the same read', () => {
            const errors = check(
                '{ articles { author { name } tags { items { name } } translations { locale } } }'
            );

            expect(errors.map((error) => error.message)).toContainEqual(
                expect.stringMatching(/may touch about 1220 records/)
            );
        });

        it('counts a localeGroupId locator the same way', () => {
            expect(
                check(
                    '{ article(localeGroupId: "g", locale: "de") { tags { items { name } } } }',
                    { maxComplexity: 25 }
                )
            ).toEqual([]);
        });
    });

    describe('variable defaults', () => {
        it('costs a page size that comes from the variable default', () => {
            // The value graphql-js will actually substitute. Reading only the
            // supplied variables let the budget be defeated by moving the
            // number one token to the left.
            const errors = check(
                'query Q($n: Int = 500) { articles(pageSize: $n) { items { tags(pageSize: $n) { items { id } } } } }',
                { maxComplexity: 1000 }
            );

            expect(errors.map((error) => error.message)).toContainEqual(
                expect.stringMatching(/may touch about 250500 records/)
            );
        });

        it('lets a supplied variable override the default', () => {
            expect(
                check(
                    'query Q($n: Int = 500) { articles(pageSize: $n) { items { tags(pageSize: $n) { items { id } } } } }',
                    { maxComplexity: 1000 },
                    { n: 5 }
                )
            ).toEqual([]);
        });
    });

    describe('complexity', () => {
        it('refuses a shallow but enormous query', () => {
            // Depth 3 — a depth cap alone would wave this straight through.
            const errors = check(
                '{ articles(pageSize: 100) { items { tags(pageSize: 100) { items { id } } } } }',
                { maxComplexity: 1000 }
            );

            expect(errors[0].message).toMatch(/may touch about \d+ records/);
        });

        it('reads a page size passed as a variable', () => {
            const errors = check(
                'query Q($n: Int) { articles(pageSize: $n) { items { tags(pageSize: $n) { items { id } } } } }',
                { maxComplexity: 1000 },
                { n: 100 }
            );

            expect(errors.map((error) => error.message)).toContainEqual(
                expect.stringMatching(/may touch about/)
            );
        });

        it('does not count `items` as a list of its own', () => {
            // `items` is the page its parent already sized. Counting it again
            // squares every list, which rejected ordinary documents.
            expect(
                check('{ articles(pageSize: 25) { items { id title } } }', {
                    maxComplexity: 100
                })
            ).toEqual([]);
        });

        it('allows the same shape at a sane page size', () => {
            expect(
                check(
                    '{ articles(pageSize: 5) { items { tags(pageSize: 5) { items { id } } } } }',
                    { maxComplexity: 1000 }
                )
            ).toEqual([]);
        });
    });

    describe('operations per request', () => {
        it('refuses an unnamed multi-operation document', () => {
            const errors = check('query A { x } query B { y }');

            expect(errors[0].message).toMatch(/one operation per request/);
        });

        it('accepts one when the caller names it', () => {
            expect(check('query A { x } query B { y }', {}, {}, 'A')).toEqual(
                []
            );
        });

        it('reports a name that matches nothing', () => {
            const errors = check('query A { x }', {}, {}, 'Nope');

            expect(errors[0].message).toMatch(/No operation named "Nope"/);
        });

        it('reports a document with no operation at all', () => {
            const errors = check('fragment f on Article { id }');

            expect(errors[0].message).toMatch(/defines no operation/);
        });
    });
});
