import { segmentIdsForTags } from '@orthacms/segments-domain';

/** What "Try a reader" answers. */
export type ReaderTestResult = {
    /** Whether a reader carrying these tags is in the audience. */
    inAudience: boolean;
    /**
     * A tag the reader carries that matches one of the audience's **only when
     * case is ignored** — the near miss worth pointing out, because matching is
     * exact and `Acme` is not `acme`.
     */
    nearMiss: string | null;
};

/**
 * The tags an audience actually answers to. **An audience with none answers to
 * its key** — the server fills that in on create, and the hint under the field
 * says so.
 */
export function effectiveTags(tags: readonly string[], key: string): string[] {
    if (tags.length) return [...tags];
    const trimmed = key.trim();
    return trimmed ? [trimmed] : [];
}

/**
 * A reader's tags as typed into the tester: comma-separated, the way the
 * header resolver reads them off a request, trimmed, blanks dropped.
 */
export function parseReaderTags(input: string): string[] {
    return input
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean);
}

/**
 * Would a reader carrying `readerTags` be in an audience answering to
 * `audienceTags`?
 *
 * Asked through the kernel's own `segmentIdsForTags`, so the tester cannot
 * disagree with what the server does when that reader arrives.
 */
export function testReader(
    audienceTags: readonly string[],
    readerTags: readonly string[]
): ReaderTestResult {
    const probe = {
        id: 'probe',
        key: 'probe',
        label: 'probe',
        tags: audienceTags
    };
    const inAudience = segmentIdsForTags([probe], readerTags).has('probe');
    if (inAudience) return { inAudience, nearMiss: null };
    const folded = new Set(audienceTags.map((tag) => tag.toLowerCase()));
    const nearMiss =
        readerTags.find((tag) => folded.has(tag.toLowerCase())) ?? null;
    return { inAudience, nearMiss };
}
