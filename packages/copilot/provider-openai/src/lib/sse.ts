/**
 * The largest event this reader will assemble before giving up, in characters.
 *
 * A server that streams without ever sending an event boundary — a proxy that
 * buffers, a runtime answering in a format this is not — would otherwise grow
 * one string for the whole 120 s request budget, with no ceiling but the heap.
 */
export const MAX_EVENT_CHARS = 1_048_576;

/**
 * Yields the `data` payloads of a `text/event-stream` body, terminating on the
 * `[DONE]` sentinel. Small on purpose: the copilot needs exactly this much of
 * SSE, and a dependency for it would not earn its place.
 *
 * Events are framed on the **blank line** the format defines, not on every
 * newline, so a legal multi-line `data:` event arrives as one payload rather
 * than as several fragments that each fail to parse and are dropped in silence.
 * Everything else in a frame — comments, `event:`, `id:`, `retry:` — is ignored,
 * and `\r\n` is tolerated throughout.
 *
 * @throws {Error} when a single event exceeds {@link MAX_EVENT_CHARS}.
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
            // `stream: true` is load-bearing: a multi-byte character split
            // across two reads is otherwise decoded as two replacement chars.
            buffer += decoder.decode(value, { stream: true });

            let boundary = nextBoundary(buffer);
            while (boundary) {
                const frame = buffer.slice(0, boundary.index);
                buffer = buffer.slice(boundary.index + boundary.length);
                boundary = nextBoundary(buffer);

                const payload = dataOf(frame);
                if (payload === DONE) {
                    return;
                }
                if (payload) {
                    yield payload;
                }
            }

            if (buffer.length > MAX_EVENT_CHARS) {
                throw new Error(
                    `Copilot model stream sent over ${MAX_EVENT_CHARS} characters with no event boundary; giving up rather than buffering the rest.`
                );
            }
        }

        // A stream that ends without the final blank line still had a whole
        // event in it, and dropping the last chunk of an answer to punish the
        // server's formatting would be the wrong trade.
        const tail = dataOf(buffer);
        if (tail && tail !== DONE) {
            yield tail;
        }
    } finally {
        // Releasing the lock lets an aborted request tear the socket down
        // instead of leaking it for the life of the process.
        reader.releaseLock();
    }
}

const DONE = '[DONE]';

/** Where the next event boundary starts, and how long it is. */
function nextBoundary(
    buffer: string
): { index: number; length: number } | undefined {
    let index = -1;
    let length = 0;
    for (const separator of ['\n\n', '\r\n\r\n', '\r\r']) {
        const at = buffer.indexOf(separator);
        if (at !== -1 && (index === -1 || at < index)) {
            index = at;
            length = separator.length;
        }
    }
    return index === -1 ? undefined : { index, length };
}

/**
 * One frame's `data` payload: every `data:` line in it, joined with newlines as
 * the format prescribes. Lines of any other kind — a `: keep-alive` comment, an
 * `event:` name — contribute nothing.
 */
function dataOf(frame: string): string {
    const parts: string[] = [];
    for (const rawLine of frame.split('\n')) {
        const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;
        if (!line.startsWith('data:')) {
            continue;
        }
        parts.push(line.slice('data:'.length).trim());
    }
    return parts.join('\n');
}
