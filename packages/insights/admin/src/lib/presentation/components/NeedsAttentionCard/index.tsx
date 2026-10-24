import { defineMessages, useIntl } from 'react-intl';
import { Card } from '@orthacms/design-system';
import type { InsightsSignal } from '../../slots/insightsSlots';
import { useInsightsRange } from '../../../hooks/useInsightsRange';
import { WidgetBoundary } from '../WidgetBoundary';

/** Intl descriptors for the Needs-attention card, co-located here. */
const messages = defineMessages({
    title: {
        id: 'insights.attention.title',
        defaultMessage: 'Needs attention'
    },
    hint: {
        id: 'insights.attention.hint',
        defaultMessage: 'click a line to see the records'
    }
});

/** Props for {@link NeedsAttentionCard}. */
export type NeedsAttentionCardProps = {
    /** The lines this reader may see, in order. */
    signals: readonly InsightsSignal[];
    /** The open drill-down's signal id, or `null`. */
    openSignal: string | null;
    /** Opens a signal's drill-down. */
    onOpen: (id: string) => void;
};

/**
 * The card the page leads with: every count that asks for somebody's work, in
 * one place, each line opening the records behind it. Charts come second.
 *
 * The page contributes no line of its own — each comes through
 * `INSIGHTS_SIGNAL_SLOT` from the package that owns the data, and each is
 * isolated in its own boundary, so a line that throws leaves the others
 * standing, exactly like a widget.
 */
export function NeedsAttentionCard({
    signals,
    openSignal,
    onOpen
}: NeedsAttentionCardProps) {
    const intl = useIntl();
    const { range } = useInsightsRange();

    return (
        <Card
            className="overflow-hidden shadow-none"
            data-testid="needs-attention"
        >
            <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 border-b px-4 py-3">
                <h3 className="text-[15px] font-semibold tracking-[-0.005em]">
                    {intl.formatMessage(messages.title)}
                </h3>
                <span className="text-xs text-muted-foreground">
                    {intl.formatMessage(messages.hint)}
                </span>
            </div>
            <ul className="divide-y">
                {signals.map((signal) => (
                    <li key={signal.id} data-signal-id={signal.id}>
                        <WidgetBoundary
                            variant="line"
                            title={intl.formatMessage({
                                id: signal.titleId,
                                defaultMessage: signal.defaultTitle
                            })}
                            resetKey={range}
                        >
                            <signal.Component
                                onOpen={() => onOpen(signal.id)}
                                isOpen={openSignal === signal.id}
                            />
                        </WidgetBoundary>
                    </li>
                ))}
            </ul>
        </Card>
    );
}
