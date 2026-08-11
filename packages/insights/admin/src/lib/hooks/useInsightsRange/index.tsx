import {
    createContext,
    useContext,
    useMemo,
    useState,
    type ReactNode
} from 'react';

/** The time windows the Insights page offers. */
export const INSIGHTS_RANGES = ['7d', '30d', '90d', '12m'] as const;

/** A selected Insights time window. */
export type InsightsRange = (typeof INSIGHTS_RANGES)[number];

/** Day count each range covers — what widgets send to their endpoint. */
const RANGE_DAYS: Record<InsightsRange, number> = {
    '7d': 7,
    '30d': 30,
    '90d': 90,
    '12m': 365
};

/** The default window — long enough to show a trend, short enough to be current. */
const DEFAULT_RANGE: InsightsRange = '30d';

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
 */
export function InsightsRangeProvider({ children }: { children: ReactNode }) {
    const [range, setRange] = useState<InsightsRange>(DEFAULT_RANGE);

    const value = useMemo<InsightsRangeValue>(
        () => ({ range, days: RANGE_DAYS[range], setRange }),
        [range]
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
