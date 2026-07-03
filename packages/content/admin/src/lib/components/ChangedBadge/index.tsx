import { defineMessages, useIntl } from 'react-intl';

const messages = defineMessages({
    changed: {
        id: 'content.field.changed',
        defaultMessage: 'Changed'
    }
});

/**
 * A small **yellow** "Changed" pill marking a field (or relation section) with
 * unsaved edits, so the user can see at a glance what a Save will persist. Shared
 * by the General tab's field cells and the Relations tab's section headers.
 */
export function ChangedBadge() {
    const intl = useIntl();
    return (
        <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[0.6875rem] font-medium leading-none text-amber-800 dark:bg-amber-500/15 dark:text-amber-500">
            {intl.formatMessage(messages.changed)}
        </span>
    );
}
