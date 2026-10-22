import { defineMessages, useIntl } from 'react-intl';
import { Badge } from '@orthacms/design-system';

/** Intl descriptors for the tab marker, co-located here. */
const messages = defineMessages({
    // Read after the tab's own name, so a screen reader hears
    // "Content, 2 to fix before publishing". The count itself is aria-hidden.
    issues: {
        id: 'content.entry.tabIssues',
        defaultMessage:
            '{count, plural, one {# to fix} other {# to fix}} before publishing'
    }
});

/** Props for {@link EntryTabIssues}. */
export type EntryTabIssuesProps = {
    /** How many fields on this tab still block publishing. */
    count: number;
};

/**
 * The marker on an entry-editor tab whose fields are not yet publishable — a
 * required field left empty, or any field holding an invalid value.
 *
 * A count in a small destructive chip, the same chip "On this page" puts on
 * the section holding them, so the tab and the section say one thing. **It is
 * a number, not a tint**: a bare coloured dot would carry its meaning only for
 * people who can see it against the surrounding text.
 *
 * Renders nothing when the tab is satisfied, so a tab that is fine stays
 * visually quiet and the bar doesn't reserve width it isn't using.
 */
export function EntryTabIssues({ count }: EntryTabIssuesProps) {
    const intl = useIntl();

    if (count <= 0) {
        return null;
    }

    return (
        <>
            <Badge
                variant="destructive-soft"
                size="xs"
                className="tabular-nums"
                aria-hidden
            >
                {count}
            </Badge>
            <span className="sr-only">
                {intl.formatMessage(messages.issues, { count })}
            </span>
        </>
    );
}
