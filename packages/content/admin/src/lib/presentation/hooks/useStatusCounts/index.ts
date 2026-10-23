import {
    useContentPipeline,
    useContentUnshipped
} from '../../../application/useContentInsights';
import { QUICK_STATUS, type QuickStatus } from '../../statusQuickFilter';

/**
 * How many of a type's records each status chip would show, from the same two
 * insights reads the overview's type cards join: `pipeline` counts drafts
 * **including** modified ones, `unshipped` counts the modified, so a
 * never-published draft is the difference.
 *
 * `undefined` until both reads have answered, and for a localized type: the
 * insights count every locale's row while the table shows one locale, so the
 * figure on the chip would disagree with the list it filters.
 */
export function useStatusCounts(
    typeName: string,
    enabled: boolean
): Record<QuickStatus, number> | undefined {
    const pipeline = useContentPipeline();
    const unshipped = useContentUnshipped();
    if (!enabled || !pipeline.data || !unshipped.data) return undefined;
    const row = pipeline.data.types.find((type) => type.name === typeName);
    if (!row) return undefined;
    const modified =
        unshipped.data.types.find((type) => type.name === typeName)?.modified ??
        0;
    return {
        [QUICK_STATUS.Published]: row.published,
        [QUICK_STATUS.Modified]: modified,
        [QUICK_STATUS.Draft]: Math.max(0, row.drafts - modified)
    };
}
