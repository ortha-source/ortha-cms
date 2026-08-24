import {
    createContext,
    useCallback,
    useContext,
    useMemo,
    type ReactNode
} from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    DEFAULT_RANGE,
    INSIGHTS_RANGE_PARAM,
    RANGE_DAYS,
    insightsRangeParam,
    parseInsightsRange,
    type InsightsRange
} from '../../utils/insightsRange';

export { INSIGHTS_RANGES } from '../../utils/insightsRange';
export type { InsightsRange } from '../../utils/insightsRange';

/** What {@link useInsightsRange} hands a widget. */
export type InsightsRangeValue = {
    /** The selected window. */
    range: InsightsRange;
    /** That window in days — put this in the query key and the request params. */
    days: number;
    /** Selects a different window. Owned by the page's range picker. */
    setRange: (range: InsightsRange) => void;
};

const InsightsRangeContext = createContext<InsightsRangeValue | null>(null);

/**
 * Provides the shared Insights time window. The page owns the picker; every
 * widget reads the selection from here, so changing the range refetches all of
 * them without the page knowing what any of them fetch.
 *
 * **The URL is the source of truth** (`?range=90d`), not component state. A
 * dashboard someone is describing has to be the dashboard they can paste to a
 * colleague, and a range held in `useState` silently sent them somewhere else;
 * it also did not survive a reload or a click into an entry and back out. Every
 * other list surface in the admin already settled this the same way, through
 * `useTableUrlState` — this is that convention, minus the paging it has no use
 * for.
 *
 * `replace`, not `push`: the range picker is a view control, and making Back
 * step through eight range changes before it leaves the page is the behaviour
 * `useTableUrlState` deliberately avoids for search and filters.
 */
export function InsightsRangeProvider({ children }: { children: ReactNode }) {
    const [searchParams, setSearchParams] = useSearchParams();
    const range = parseInsightsRange(searchParams.get(INSIGHTS_RANGE_PARAM));

    const setRange = useCallback(
        (next: InsightsRange) => {
            // Merged into the existing query rather than replacing it: the
            // shell and contributed widgets are free to keep their own params,
            // and a range change must not drop them.
            setSearchParams(
                (prev) => {
                    const params = new URLSearchParams(prev);
                    const value = insightsRangeParam(next);
                    if (value) params.set(INSIGHTS_RANGE_PARAM, value);
                    else params.delete(INSIGHTS_RANGE_PARAM);
                    return params;
                },
                { replace: true }
            );
        },
        [setSearchParams]
    );

    const value = useMemo<InsightsRangeValue>(
        () => ({ range, days: RANGE_DAYS[range], setRange }),
        [range, setRange]
    );

    return (
        <InsightsRangeContext.Provider value={value}>
            {children}
        </InsightsRangeContext.Provider>
    );
}

/**
 * Reads the selected Insights time window.
 *
 * Falls back to the default window rather than throwing when used outside the
 * provider: a widget is contributed by another package and may well be rendered
 * in a test or a storybook that has no Insights page around it, and a hard
 * throw there would be a trap rather than a helpful error.
 */
export function useInsightsRange(): InsightsRangeValue {
    const value = useContext(InsightsRangeContext);
    if (value) return value;
    return {
        range: DEFAULT_RANGE,
        days: RANGE_DAYS[DEFAULT_RANGE],
        setRange: () => undefined
    };
}
