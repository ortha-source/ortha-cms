/** One line of the explanation — one check, in the order it was made. */
export type ExplainStep = {
    /** `exclusions`, `window`, or `group 1`. */
    label: string;
    /** Whether this step admitted the reader. */
    passed: boolean;
    /** Why, in the vocabulary of the model rather than of SQL. */
    detail: string;
};

/** The whole answer for one reader on one entry. */
export type ExplainResult = {
    /** Whether the reader sees the entry. */
    visible: boolean;
    /** Which group let them through; `-1` when the rule restricts nothing. */
    matchedGroup: number;
    /** Absent when the reader got in. */
    reason?: string;
    /** What a refused reader is served. */
    fallback?: string;
    /** The segments the reader's tags resolved to, by segment type key. */
    readerSegments: Record<string, string[]>;
    /** The levels that contributed to the resolved rule. */
    contributors: readonly string[];
    /** One step per check. */
    steps: ExplainStep[];
};
