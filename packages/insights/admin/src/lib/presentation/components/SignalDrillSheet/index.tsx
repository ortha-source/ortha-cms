import { defineMessages, useIntl } from 'react-intl';
import { Sheet, SheetContent } from '@orthacms/design-system';
import type { InsightsSignal } from '../../slots/insightsSlots';
import { WidgetBoundary } from '../WidgetBoundary';

/** Intl descriptors for the drill-down sheet, co-located here. */
const messages = defineMessages({
    close: { id: 'insights.drill.close', defaultMessage: 'Close' }
});

/** Props for {@link SignalDrillSheet}. */
export type SignalDrillSheetProps = {
    /** The signal whose records are showing, or `null` when closed. */
    signal: InsightsSignal | null;
    /** Closes the panel. */
    onClose: () => void;
};

/**
 * The side panel a Needs-attention line opens: the records behind its count.
 *
 * The page owns the panel — opening, closing, focus, the `?signal=` it lives
 * in — and the contributing package owns what is inside it (its `Drill`,
 * which renders a `SignalDrill`). The `Drill` mounts only while its panel is
 * open, so a line costs one request until somebody asks for the records.
 */
export function SignalDrillSheet({ signal, onClose }: SignalDrillSheetProps) {
    const intl = useIntl();
    return (
        <Sheet open={signal !== null} onOpenChange={(open) => !open && onClose()}>
            <SheetContent
                className="flex w-full flex-col gap-0 p-0 sm:max-w-[460px]"
                closeLabel={intl.formatMessage(messages.close)}
                data-testid="signal-drill"
            >
                {signal ? (
                    <WidgetBoundary
                        title={intl.formatMessage({
                            id: signal.titleId,
                            defaultMessage: signal.defaultTitle
                        })}
                        resetKey={signal.id}
                    >
                        <signal.Drill />
                    </WidgetBoundary>
                ) : null}
            </SheetContent>
        </Sheet>
    );
}
