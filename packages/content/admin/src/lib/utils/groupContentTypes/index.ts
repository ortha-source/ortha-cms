import type { ContentType } from '../../types/contentType';

/** Content types split into the sidebar's two sub-categories. */
export type GroupedContentTypes = {
    /** `kind: 'collection'` — multi-entry collections. */
    collections: ContentType[];
    /** `kind: 'single'` — standalone pages. */
    pages: ContentType[];
};

/**
 * Splits content types into Collections (`collection`) and Pages (`single`),
 * preserving registration order within each group. Shared by the sidebar groups
 * and the search palette so both render the same partition.
 */
export function groupContentTypes(types: ContentType[]): GroupedContentTypes {
    const collections: ContentType[] = [];
    const pages: ContentType[] = [];
    for (const type of types) {
        if (type.kind === 'single') {
            pages.push(type);
        } else {
            collections.push(type);
        }
    }
    return { collections, pages };
}
