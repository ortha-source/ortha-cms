/** Longest title we store. Long enough to be recognisable in a list, no more. */
const MAX_TITLE_LENGTH = 60;

/**
 * Names a thread from its opening message.
 *
 * Deliberately **not** a model call: titling is the kind of thing that quietly
 * doubles the cost and latency of starting a chat, and the first line of what
 * someone typed is a better title than a summary anyway. Phase 4 can revisit it
 * when there is a settings surface to make it optional.
 *
 * Returns `null` for an effectively empty message, leaving the thread untitled
 * rather than titled with whitespace.
 */
export function deriveTitle(message: string): string | null {
    // Collapse all whitespace first: a pasted multi-line message would
    // otherwise produce a title with a newline in it, which renders as a
    // broken row rather than a truncated one.
    const collapsed = message.replace(/\s+/g, ' ').trim();
    if (collapsed.length === 0) {
        return null;
    }
    if (collapsed.length <= MAX_TITLE_LENGTH) {
        return collapsed;
    }
    // Prefer cutting at a word boundary, but only if that leaves most of the
    // budget used — otherwise a single very long word would truncate to almost
    // nothing.
    const clipped = collapsed.slice(0, MAX_TITLE_LENGTH);
    const lastSpace = clipped.lastIndexOf(' ');
    const cut = lastSpace > MAX_TITLE_LENGTH * 0.6 ? lastSpace : clipped.length;
    return `${clipped.slice(0, cut).trimEnd()}…`;
}
