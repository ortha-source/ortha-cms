import { defineMessages, useIntl } from 'react-intl';

const messages = defineMessages({
    count: {
        id: 'content.editor.groupCount',
        defaultMessage: '{count, plural, one {# field} other {# fields}}'
    }
});

/**
 * A field-group separator in the record editor's Data tab: an uppercase group
 * label on the left, a hairline rule filling the middle, and the group's field
 * count on the right. Presentational — the parent supplies the localized label.
 */
export function FieldGroupHeader({
    label,
    count
}: {
    label: string;
    count: number;
}) {
    const intl = useIntl();
    return (
        <div className="flex items-center gap-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {label}
            </span>
            <div className="h-px flex-1 bg-border" />
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {intl.formatMessage(messages.count, { count })}
            </span>
        </div>
    );
}
