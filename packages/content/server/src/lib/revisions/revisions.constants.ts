/** Default page size for the entry revision timeline. */
export const REVISIONS_PAGE_SIZE = 20;

/**
 * How many linked records the preview resolves to titles **per relation field**.
 * The snapshot stores the full ordered id list, but a relation can hold
 * thousands of links — the preview shows the first {@link PREVIEW_RELATION_REF_CAP}
 * with a "+N more", so a single detail read never resolves a huge link set.
 */
export const PREVIEW_RELATION_REF_CAP = 50;
