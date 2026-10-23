import { defineMessages, useIntl } from 'react-intl';
import { Link2 } from 'lucide-react';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger
} from '@orthacms/design-system';

const messages = defineMessages({
    shared: {
        id: 'content.form.shared',
        defaultMessage: 'All locales'
    },
    sharedHint: {
        id: 'content.form.sharedHint',
        defaultMessage:
            'This value is the same in every locale — editing it here changes it everywhere.'
    }
});

/**
 * The counterpart of `LocalizedFieldMark` for a **shared** field on a
 * localized type: one value for every locale, so an edit here changes the
 * record in all of them. It used to be said once, above a "Shared fields"
 * group; the form now keeps the schema's order instead of splitting by locale
 * scope, so each shared field says it beside its own label.
 *
 * A real `<button>` for the reason the globe is one — a hint reachable only by
 * hovering is unreachable by keyboard and touch — and it suppresses the
 * surrounding label's activation so reading it never focuses the control.
 */
export function SharedFieldMark() {
    const intl = useIntl();
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <button
                    type="button"
                    onClick={(event) => event.preventDefault()}
                    className="inline-flex shrink-0 items-center gap-1 rounded text-xs font-normal text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                    <Link2 aria-hidden className="size-3.5" />
                    {intl.formatMessage(messages.shared)}
                </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-64">
                {intl.formatMessage(messages.sharedHint)}
            </TooltipContent>
        </Tooltip>
    );
}
