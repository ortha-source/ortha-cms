/**
 * Yields the `data:` payloads of a `text/event-stream` body, terminating on
 * the `[DONE]` sentinel. Small on purpose: the copilot needs exactly this much
 * of SSE, and a dependency for it would not earn its place.
 */
export async function* readDataEvents(
    body: ReadableStream<Uint8Array>
): AsyncGenerator<string> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
        for (;;) {
            const { done, value } = await reader.read();
            if (done) {
                break;
            }
            buffer += decoder.decode(value, { stream: true });

            // Events are separated by a blank line, but every server we target
            // emits exactly one `data:` line per event, so splitting on
            // newlines and ignoring everything else is both simpler and more
            // forgiving of `\r\n` and stray comment/keep-alive lines.
            let newline = buffer.indexOf('\n');
            while (newline !== -1) {
                const line = buffer.slice(0, newline).trim();
                buffer = buffer.slice(newline + 1);
                newline = buffer.indexOf('\n');

                if (!line.startsWith('data:')) {
                    continue;
                }
                const payload = line.slice('data:'.length).trim();
                if (payload === '[DONE]') {
                    return;
                }
                if (payload) {
                    yield payload;
                }
            }
        }

        const tail = buffer.trim();
        if (tail.startsWith('data:')) {
            const payload = tail.slice('data:'.length).trim();
            if (payload && payload !== '[DONE]') {
                yield payload;
            }
        }
    } finally {
        // Releasing the lock lets an aborted request tear the socket down
        // instead of leaking it for the life of the process.
        reader.releaseLock();
    }
}
