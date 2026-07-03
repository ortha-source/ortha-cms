import { defineMessages, useIntl } from 'react-intl';

const messages = defineMessages({
    changed: {
        id: 'content.field.changed',
        defaultMessage: 'Changed'
    }
});

/**
 * A small "Changed" pill marking a field (or relation section) with unsaved
 * edits, so the user can see at a glance what a Save will persist. Shared by the
 * General tab's field cells and the Relations tab's section headers.
 */
export function ChangedBadge() {
    const intl = useIntl();
    return (
        <span className="rounded-full bg-accent px-1.5 py-0.5 text-[0.6875rem] font-medium leading-none text-muted-foreground">
            {intl.formatMessage(messages.changed)}
        </span>
    );
}
