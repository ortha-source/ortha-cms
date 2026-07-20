import type { ContentType } from '../types/contentType';
import { CONTENT_TYPE_KIND } from '../constants';

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
        if (type.kind === CONTENT_TYPE_KIND.Single) {
            pages.push(type);
        } else {
            collections.push(type);
        }
    }
    return { collections, pages };
}
