import { MAX_EVENT_CHARS, readDataEvents } from './sse';

/** A body that delivers exactly these pieces, one per `read()`. */
function bodyOf(pieces: (string | Uint8Array)[]): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder();
    let index = 0;
    return new ReadableStream<Uint8Array>({
        pull(controller) {
            if (index >= pieces.length) {
                controller.close();
                return;
            }
            const piece = pieces[index];
            index += 1;
            controller.enqueue(
                typeof piece === 'string' ? encoder.encode(piece) : piece
            );
        }
    });
}

async function collect(pieces: (string | Uint8Array)[]): Promise<string[]> {
    const payloads: string[] = [];
    for await (const payload of readDataEvents(bodyOf(pieces))) {
        payloads.push(payload);
    }
    return payloads;
}

/**
 * The reader is the adapter's whole dependency on the event-stream format, and
 * every server it targets frames differently in some small way — so the
 * tolerances are pinned here rather than inferred from a provider-level test.
 */
describe('readDataEvents', () => {
    it('yields one payload per event', async () => {
        await expect(
            collect(['data: {"a":1}\n\n', 'data: {"a":2}\n\n'])
        ).resolves.toEqual(['{"a":1}', '{"a":2}']);
    });

    it('tolerates CRLF framing', async () => {
        await expect(
            collect(['data: {"a":1}\r\n\r\ndata: {"a":2}\r\n\r\n'])
        ).resolves.toEqual(['{"a":1}', '{"a":2}']);
    });

    it('skips comments, keep-alives and other fields', async () => {
        await expect(
            collect([
                ': keep-alive\n\n',
                'event: message\ndata: {"a":1}\nid: 7\n\n',
                '\n\n'
            ])
        ).resolves.toEqual(['{"a":1}']);
    });

    it('stops at the [DONE] sentinel and ignores what follows', async () => {
        await expect(
            collect(['data: {"a":1}\n\n', 'data: [DONE]\n\n', 'data: {"a":2}\n\n'])
        ).resolves.toEqual(['{"a":1}']);
    });

    it('joins a data line split across two reads', async () => {
        await expect(
            collect(['data: {"cho', 'ices":[]}\n\n'])
        ).resolves.toEqual(['{"choices":[]}']);
    });

    it('joins a multi-byte character split across two reads', async () => {
        const bytes = new TextEncoder().encode('data: {"t":"🎉"}\n\n');
        await expect(
            collect([bytes.slice(0, 13), bytes.slice(13)])
        ).resolves.toEqual(['{"t":"🎉"}']);
    });

    it('assembles a multi-line data event into one payload', async () => {
        // Legal SSE, and the shape the old line-based reader dropped in
        // silence: each line failed `JSON.parse` on its own and the answer
        // simply never arrived.
        await expect(
            collect(['data: {"choices":\ndata: [{"delta":{"content":"hi"}}]}\n\n'])
        ).resolves.toEqual(['{"choices":\n[{"delta":{"content":"hi"}}]}']);
    });

    it('flushes a final event that arrives without a trailing blank line', async () => {
        await expect(collect(['data: {"a":1}'])).resolves.toEqual(['{"a":1}']);
    });

    it('refuses to buffer an event past the ceiling', async () => {
        // A proxy that never sends a boundary used to grow this string for the
        // whole request budget, bounded only by the heap.
        const flood = `data: ${'x'.repeat(MAX_EVENT_CHARS)}`;

        await expect(collect([flood, flood])).rejects.toThrow(
            /no event boundary/
        );
    });
});
