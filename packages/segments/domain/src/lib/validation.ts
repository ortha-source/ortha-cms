/**
 * What a segment's fields may hold — the rules, in one place.
 *
 * The admin's dialog and the server's DTO both read from here rather than each
 * spelling out a pattern of its own. Two copies of a validation rule is two
 * copies to drift, and the way it shows up is the worst one available: a form
 * that accepts what the API then refuses, with the refusal arriving as a 400
 * carrying a message written for a different audience.
 */

/**
 * A segment key: lowercase, url-safe, starting with a letter or digit.
 *
 * It is also the **default reader tag**, which is why it is this narrow. A key
 * with a space or a capital in it would become a tag nobody's resolver produces,
 * and the segment would silently match nobody.
 */
export const SEGMENT_KEY_PATTERN = /^[a-z0-9][a-z0-9._-]*$/;

/** Longest accepted key. */
export const SEGMENT_KEY_MAX = 120;
/** Longest accepted label. */
export const SEGMENT_LABEL_MAX = 200;
/** Longest accepted single reader tag. */
export const SEGMENT_TAG_MAX = 200;
/** Most reader tags one segment may answer to. */
export const SEGMENT_TAGS_MAX = 20;

/** Why one field was refused. Stable keys — the admin renders its own copy. */
export const SEGMENT_ISSUE = {
    Required: 'required',
    TooLong: 'too-long',
    Malformed: 'malformed',
    TooMany: 'too-many',
    Duplicate: 'duplicate'
} as const;

/** One value of {@link SEGMENT_ISSUE}. */
export type SegmentIssue = (typeof SEGMENT_ISSUE)[keyof typeof SEGMENT_ISSUE];

/** What was wrong, per field. A field with nothing wrong is absent. */
export type SegmentIssues = {
    key?: SegmentIssue;
    label?: SegmentIssue;
    tags?: SegmentIssue;
};

/** What is being checked. */
export interface SegmentDraft {
    /** Absent when editing — the key is immutable. */
    readonly key?: string;
    readonly label: string;
    readonly tags: readonly string[];
}

/**
 * Checks one draft, returning an issue per bad field.
 *
 * Returns a **map, not a first error**: a form shows every field's problem at
 * once, and reporting them one at a time turns fixing three fields into three
 * round trips through the same button.
 *
 * `existingKeys` catches the collision the server answers 409 for. Checking it
 * here is not a second authority — the server still decides, and still wins a
 * race between two people creating the same key — it just means the common case
 * is answered inline instead of as a failed submit.
 */
export function validateSegment(
    draft: SegmentDraft,
    existingKeys: readonly string[] = []
): SegmentIssues {
    const issues: SegmentIssues = {};

    const label = draft.label.trim();
    if (!label) {
        issues.label = SEGMENT_ISSUE.Required;
    } else if (label.length > SEGMENT_LABEL_MAX) {
        issues.label = SEGMENT_ISSUE.TooLong;
    }

    if (draft.key !== undefined) {
        const key = draft.key.trim();
        if (!key) {
            issues.key = SEGMENT_ISSUE.Required;
        } else if (key.length > SEGMENT_KEY_MAX) {
            issues.key = SEGMENT_ISSUE.TooLong;
        } else if (!SEGMENT_KEY_PATTERN.test(key)) {
            issues.key = SEGMENT_ISSUE.Malformed;
        } else if (existingKeys.includes(key)) {
            issues.key = SEGMENT_ISSUE.Duplicate;
        }
    }

    // Blanks are dropped rather than refused — they are what a trailing newline
    // in a pasted list produces, and refusing a paste over its last character
    // is an argument with the user about something they cannot see.
    const tags = draft.tags.map((tag) => tag.trim()).filter(Boolean);
    if (tags.length > SEGMENT_TAGS_MAX) {
        issues.tags = SEGMENT_ISSUE.TooMany;
    } else if (tags.some((tag) => tag.length > SEGMENT_TAG_MAX)) {
        issues.tags = SEGMENT_ISSUE.TooLong;
    } else if (new Set(tags).size !== tags.length) {
        issues.tags = SEGMENT_ISSUE.Duplicate;
    }

    return issues;
}

/** Whether a draft has nothing wrong with it. */
export function isValidSegment(issues: SegmentIssues): boolean {
    return Object.keys(issues).length === 0;
}
