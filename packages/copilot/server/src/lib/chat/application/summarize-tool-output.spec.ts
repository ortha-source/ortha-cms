import { summarizeToolOutput } from './summarize-tool-output';

/**
 * The one line a reviewer reads in `copilot_tool_calls.output_summary`, and the
 * one the collapsed tool step shows. It had no spec: the shapes below are what
 * every tool in the catalogue actually returns, and the clip boundary is the
 * kind of `MAX - 1` arithmetic that is one refactor away from being wrong.
 */
describe('summarizeToolOutput', () => {
    it.each([
        ['null', null, 'no result'],
        ['undefined', undefined, 'no result'],
        ['an empty object', {}, 'no result']
    ])('reports %s as nothing found', (_label, output, expected) => {
        expect(summarizeToolOutput(output)).toBe(expected);
    });

    it('counts a bare array', () => {
        expect(summarizeToolOutput([])).toBe('0 results');
        expect(summarizeToolOutput([1])).toBe('1 result');
        expect(summarizeToolOutput([1, 2, 3])).toBe('3 results');
    });

    it.each(['items', 'rows', 'results'])(
        'counts a `%s` list',
        (key: string) => {
            expect(summarizeToolOutput({ [key]: [1, 2] })).toBe('2 results');
        }
    );

    // "12 results" is more useful than "10 results" when the caller asked for
    // the first page of twelve — the reported total wins over the page length.
    it('prefers a reported total over the page length', () => {
        expect(summarizeToolOutput({ items: [1, 2], total: 12 })).toBe(
            '12 results'
        );
        expect(summarizeToolOutput({ items: [1, 2], totalCount: 7 })).toBe(
            '7 results'
        );
        expect(summarizeToolOutput({ total: 0 })).toBe('0 results');
    });

    it('names a single object by its first three keys', () => {
        expect(summarizeToolOutput({ id: 1, title: 'a', slug: 'b' })).toBe(
            '1 result (id, title, slug)'
        );
        expect(
            summarizeToolOutput({ id: 1, title: 'a', slug: 'b', extra: 'c' })
        ).toBe('1 result (id, title, slug, …)');
    });

    it('stringifies a scalar rather than calling it nothing', () => {
        expect(summarizeToolOutput('ok')).toBe('ok');
        expect(summarizeToolOutput(42)).toBe('42');
        expect(summarizeToolOutput(false)).toBe('false');
    });

    // The boundary the audit column is sized around: 120 survives whole, 121
    // becomes 119 characters plus an ellipsis — so the stored value is never
    // longer than 120 either way.
    it('keeps exactly 120 characters and ellipsises 121', () => {
        const exact = 'x'.repeat(120);
        expect(summarizeToolOutput(exact)).toBe(exact);
        expect(summarizeToolOutput(exact)).toHaveLength(120);

        const over = summarizeToolOutput('x'.repeat(121));
        expect(over).toBe(`${'x'.repeat(119)}…`);
        expect(over).toHaveLength(120);
    });

    // A tool that returns a cycle must not take the run down with it. The
    // engine summarizes *before* it fences (`run-engine.service.ts`), so this
    // has to survive a value `JSON.stringify` cannot — and it does, because it
    // only ever reads `Object.keys`.
    it('survives a cyclic object', () => {
        const cyclic: Record<string, unknown> = { id: 1, name: 'a' };
        cyclic['self'] = cyclic;

        expect(() => summarizeToolOutput(cyclic)).not.toThrow();
        expect(summarizeToolOutput(cyclic)).toBe('1 result (id, name, self)');
    });
});
