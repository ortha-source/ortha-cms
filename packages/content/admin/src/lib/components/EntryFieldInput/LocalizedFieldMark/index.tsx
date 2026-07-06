import { defineMessages, useIntl } from 'react-intl';
import { Globe } from 'lucide-react';

const messages = defineMessages({
    localized: {
        id: 'content.form.localized',
        defaultMessage: 'Localized field'
    },
    localizedHint: {
        id: 'content.form.localizedHint',
        defaultMessage: 'This value can differ per locale.'
    }
});

/**
 * A small indicator that a field's value can differ per locale (rendered when
 * `field.localized`, only ever on i18n types). A plain span with a native
 * `title` + sr-only name — safe to sit inside a `<label>` row (no interactive
 * element). Its caller (`EntryFieldInput`'s end-adornment) handles right
 * placement, so this is just the icon.
 */
export function LocalizedFieldMark() {
    const intl = useIntl();
    return (
        <span
            className="inline-flex shrink-0 text-muted-foreground"
            title={intl.formatMessage(messages.localizedHint)}
        >
            <Globe aria-hidden className="size-3.5" />
            <span className="sr-only">
                {intl.formatMessage(messages.localized)}
            </span>
        </span>
    );
}
