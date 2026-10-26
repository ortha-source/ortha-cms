import { useRef } from 'react';
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
 *
 * Closing hands focus back to the line, and the sheet does that itself. Radix's
 * modal dialog always prevents its own close focus and then focuses its
 * `DialogTrigger`, and there is none here: the panel opens from `?signal=`,
 * not from a trigger. So Escape used to leave a keyboard user on `<body>`. The
 * line is found by the `data-signal-id` its card puts on each `<li>`. The id
 * is remembered across the close, because `signal` is already `null` when the
 * exit finishes.
 */
export function SignalDrillSheet({ signal, onClose }: SignalDrillSheetProps) {
    const intl = useIntl();
    const lastSignalId = useRef<string | null>(null);
    if (signal) lastSignalId.current = signal.id;
    return (
        <Sheet
            open={signal !== null}
            onOpenChange={(open) => !open && onClose()}
        >
            <SheetContent
                className="flex w-full flex-col gap-0 p-0 sm:max-w-[460px]"
                closeLabel={intl.formatMessage(messages.close)}
                data-testid="signal-drill"
                onCloseAutoFocus={(event) => {
                    const id = lastSignalId.current;
                    if (!id) return;
                    event.preventDefault();
                    document
                        .querySelector<HTMLElement>(
                            `[data-signal-id="${CSS.escape(id)}"] button`
                        )
                        ?.focus();
                }}
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
