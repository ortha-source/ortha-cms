import { parse } from 'graphql';
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
            const errors = check(`{ ${aliased} }`, { maxAliases: 10 });

            expect(errors[0].message).toMatch(/selects 24 fields/);
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
