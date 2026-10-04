import { ContentModelChrome } from '../ContentModelChrome';
import { ContentModelSkeleton } from '../ContentModelSkeleton';

/**
 * The lazy route's Suspense fallback. Real chrome, skeleton body — the same
 * body the page renders while its document loads, so the chunk boundary and
 * the query boundary read as one continuous loading state.
 */
export function ContentModelPageSkeleton() {
    return (
        <ContentModelChrome>
            <ContentModelSkeleton />
        </ContentModelChrome>
    );
}
