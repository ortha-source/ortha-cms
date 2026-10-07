import { createToolCallAccumulator, parseArgs } from './tool-call-accumulator';

/**
 * The wire format streams a tool call as fragments keyed by `index`, and
 * parallel calls interleave. This is the one piece of the adapter with real
 * state, so it is pinned directly rather than only through the provider.
 */
describe('createToolCallAccumulator', () => {
    it('joins argument fragments across chunks', () => {
        const accumulator = createToolCallAccumulator();

        accumulator.add([
            {
                index: 0,
                id: 'a',
                function: { name: 'search', arguments: '{"q"' }
            }
        ]);
        accumulator.add([{ index: 0, function: { arguments: ':"x"}' } }]);

        expect(accumulator.drain()).toEqual([
            { type: 'tool-call', id: 'a', name: 'search', input: { q: 'x' } }
        ]);
    });

    it('keeps interleaved parallel calls apart and emits them in index order', () => {
        const accumulator = createToolCallAccumulator();

        accumulator.add([
            {
                index: 1,
                id: 'b',
                function: { name: 'second', arguments: '{"n"' }
            },
            {
                index: 0,
                id: 'a',
                function: { name: 'first', arguments: '{"n"' }
            }
        ]);
        accumulator.add([
            { index: 0, function: { arguments: ':1}' } },
            { index: 1, function: { arguments: ':2}' } }
        ]);

        expect(accumulator.drain()).toEqual([
            { type: 'tool-call', id: 'a', name: 'first', input: { n: 1 } },
            { type: 'tool-call', id: 'b', name: 'second', input: { n: 2 } }
        ]);
    });

    it('synthesises an id when the server sent none', () => {
        const accumulator = createToolCallAccumulator();

        accumulator.add([
            { index: 3, function: { name: 'search', arguments: '{}' } }
        ]);

        expect(accumulator.drain()).toEqual([
            { type: 'tool-call', id: 'call-3', name: 'search', input: {} }
        ]);
    });

    it('drops a fragment set that never carried a name', () => {
        const accumulator = createToolCallAccumulator();

        // Inventing a name would dispatch a tool nobody asked for.
        accumulator.add([{ index: 0, id: 'a', function: { arguments: '{}' } }]);

        expect(accumulator.drain()).toEqual([]);
    });

    it('announces a call once, in the chunk that names it', () => {
        const accumulator = createToolCallAccumulator();

        expect(
            accumulator.add([
                {
                    index: 0,
                    id: 'a',
                    function: { name: 'search', arguments: '{"q"' }
                }
            ])
        ).toEqual([{ type: 'tool-call-start', id: 'a', name: 'search' }]);
        // The arguments still arriving announce nothing further.
        expect(
            accumulator.add([{ index: 0, function: { arguments: ':"x"}' } }])
        ).toEqual([]);
    });

    it('waits for the id before announcing, so the start and the call agree', () => {
        const accumulator = createToolCallAccumulator();

        expect(
            accumulator.add([{ index: 0, function: { name: 'search' } }])
        ).toEqual([]);
        expect(accumulator.add([{ index: 0, id: 'a' }])).toEqual([
            { type: 'tool-call-start', id: 'a', name: 'search' }
        ]);
    });

    it('never announces a call whose id the server never sent', () => {
        const accumulator = createToolCallAccumulator();

        // It is drained under a synthesised id the start could not have known,
        // so it runs unannounced rather than leaving a step that never resolves.
        expect(
            accumulator.add([
                { index: 3, function: { name: 'search', arguments: '{}' } }
            ])
        ).toEqual([]);
        expect(accumulator.drain()).toHaveLength(1);
    });

    it('is empty when nothing was added', () => {
        expect(createToolCallAccumulator().drain()).toEqual([]);
    });
});

describe('parseArgs', () => {
    it('parses well-formed JSON', () => {
        expect(parseArgs('{"q":"x"}')).toEqual({ q: 'x' });
    });

    it.each(['', '   ', '{not json', '{"q":'])(
        'falls back to {} for %p rather than killing the run',
        (input) => {
            // Schema validation downstream then returns a tool error the model
            // can recover from — far better than a dead stream.
            expect(parseArgs(input)).toEqual({});
        }
    );
});
