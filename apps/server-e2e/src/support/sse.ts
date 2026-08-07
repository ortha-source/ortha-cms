import type { CopilotRunEvent } from '@ortha-cms/copilot-domain';

/**
 * Parses a buffered `text/event-stream` body into its frames.
 *
 * The suites assert on the *sequence and content* of frames, not on their
 * arrival timing — supertest buffers the whole response, so incrementality
 * cannot be observed here. That it genuinely streams (and survives the admin's
 * Vite dev proxy unbuffered, on POST as well as GET) was proven separately with
 * a live client; this parser covers everything else.
 *
 * Comment frames (`: open`, `: ping`) are skipped: they carry no data and exist
 * only to flush headers and keep an idle connection alive.
 */
export function parseSse(body: string): CopilotRunEvent[] {
    return body
        .split('\n\n')
        .map((block) => block.trim())
        .filter((block) => block.length > 0 && !block.startsWith(':'))
        .flatMap((block) => {
            const data = block
                .split('\n')
                .find((line) => line.startsWith('data: '));
            return data
                ? [JSON.parse(data.slice('data: '.length)) as CopilotRunEvent]
                : [];
        });
}

/** Every frame of one kind, narrowed. */
export function framesOfType<T extends CopilotRunEvent['type']>(
    events: CopilotRunEvent[],
    type: T
): Extract<CopilotRunEvent, { type: T }>[] {
    return events.filter(
        (event): event is Extract<CopilotRunEvent, { type: T }> =>
            event.type === type
    );
}

/** The concatenated assistant answer — every `text-delta`, in order. */
export function assembledText(events: CopilotRunEvent[]): string {
    return framesOfType(events, 'text-delta')
        .map((event) => event.text)
        .join('');
}
