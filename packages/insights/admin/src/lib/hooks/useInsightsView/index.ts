import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    INSIGHTS_SIGNAL_PARAM,
    INSIGHTS_TAB_PARAM,
    insightsTabParam,
    resolveInsightsSignal,
    resolveInsightsTab
} from '../../utils/insightsView';

/** What {@link useInsightsView} hands the page. */
export type InsightsView = {
    /** The tab showing — a section id — or `undefined` when there are none. */
    tab: string | undefined;
    /** Switches tabs. */
    setTab: (tab: string) => void;
    /** The open drill-down's signal id, or `null`. */
    signal: string | null;
    /** Opens a signal's drill-down, or closes it with `null`. */
    setSignal: (signal: string | null) => void;
};

/**
 * The page's tab and open drill-down, read from and written to the URL.
 *
 * Writes `replace` and **merge** with the other params, exactly as the range
 * does (`[insights:I-18]`): these are view controls, Back should leave the
 * page rather than step through them, and switching tabs must not drop the
 * selected range.
 */
export function useInsightsView({
    tabs,
    signals
}: {
    /** The section ids that have something to show, in order. */
    tabs: readonly string[];
    /** The signal ids this reader may see. */
    signals: readonly string[];
}): InsightsView {
    const [searchParams, setSearchParams] = useSearchParams();
    const tab = resolveInsightsTab(searchParams.get(INSIGHTS_TAB_PARAM), tabs);
    const signal = resolveInsightsSignal(
        searchParams.get(INSIGHTS_SIGNAL_PARAM),
        signals
    );
    const tabKey = tabs.join(',');

    const write = useCallback(
        (key: string, value: string | undefined | null) => {
            setSearchParams(
                (prev) => {
                    const params = new URLSearchParams(prev);
                    if (value) params.set(key, value);
                    else params.delete(key);
                    return params;
                },
                { replace: true }
            );
        },
        [setSearchParams]
    );

    const setTab = useCallback(
        (next: string) =>
            write(
                INSIGHTS_TAB_PARAM,
                insightsTabParam(next, tabKey ? tabKey.split(',') : [])
            ),
        [write, tabKey]
    );
    const setSignal = useCallback(
        (next: string | null) => write(INSIGHTS_SIGNAL_PARAM, next),
        [write]
    );

    return { tab, setTab, signal, setSignal };
}
