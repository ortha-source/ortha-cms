import { defineMessages, useIntl } from 'react-intl';
import { Input, Label } from '@ortha-cms/design-system';

/** Intl descriptors for {@link ActivityDateRange}, co-located. */
const messages = defineMessages({
    from: {
        id: 'activity.filter.from',
        defaultMessage: 'From'
    },
    to: {
        id: 'activity.filter.to',
        defaultMessage: 'To'
    }
});

/**
 * The event-time range filter: two native date inputs (`from`/`to`, each
 * `yyyy-mm-dd`), each with a visible label. An empty value clears that bound.
 */
export function ActivityDateRange({
    from,
    to,
    onFromChange,
    onToChange
}: {
    from: string;
    to: string;
    onFromChange: (value: string) => void;
    onToChange: (value: string) => void;
}) {
    const intl = useIntl();

    return (
        <div className="flex flex-wrap items-end gap-3">
            <div className="grid gap-1.5">
                <Label htmlFor="activity-from" className="text-xs">
                    {intl.formatMessage(messages.from)}
                </Label>
                <Input
                    id="activity-from"
                    type="date"
                    value={from}
                    max={to || undefined}
                    onChange={(event) => onFromChange(event.target.value)}
                    className="h-9 w-[160px] rounded-lg shadow-none"
                />
            </div>
            <div className="grid gap-1.5">
                <Label htmlFor="activity-to" className="text-xs">
                    {intl.formatMessage(messages.to)}
                </Label>
                <Input
                    id="activity-to"
                    type="date"
                    value={to}
                    min={from || undefined}
                    onChange={(event) => onToChange(event.target.value)}
                    className="h-9 w-[160px] rounded-lg shadow-none"
                />
            </div>
        </div>
    );
}
