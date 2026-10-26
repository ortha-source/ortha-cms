import {
    DEFAULT_INSIGHTS_ORDER,
    type InsightsSignal
} from '../../presentation/slots/insightsSlots';

/** Everything {@link resolveInsightsSignals} needs. All of it plain data. */
export type ResolveInsightsSignalsInput = {
    /** Signal contributions, in registration order. */
    signals: readonly InsightsSignal[];
    /** Permission keys the signed-in user holds. */
    permissions: readonly string[];
};

/**
 * The Needs-attention lines the signed-in user may see, in order.
 *
 * The same two rules as the widget fold, for the same reasons: a line whose
 * `permission` the user lacks is dropped **before** the card decides whether
 * it has anything to show (so a reader without `content:read` gets no card
 * with no lines in it), and the sort is stable, so two plugins contributing at
 * one `order` produce one deterministic card. A missing `order` reads as
 * {@link DEFAULT_INSIGHTS_ORDER}, after the built-in lines.
 */
export function resolveInsightsSignals({
    signals,
    permissions
}: ResolveInsightsSignalsInput): InsightsSignal[] {
    const granted = new Set(permissions);
    return signals
        .filter((signal) => !signal.permission || granted.has(signal.permission))
        .slice()
        .sort(
            (a, b) =>
                (a.order ?? DEFAULT_INSIGHTS_ORDER) -
                (b.order ?? DEFAULT_INSIGHTS_ORDER)
        );
}
