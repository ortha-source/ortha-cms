import { defineMessages, useIntl } from 'react-intl';
import { Globe, Lock } from 'lucide-react';
import { ChangedBadge } from '@orthacms/content-admin';
import type { EntryAccess } from '../../../../domain/types';

const messages = defineMessages({
    everyone: {
        id: 'segments.accessLine.everyone',
        defaultMessage: 'Public — every reader can see it.'
    },
    everyoneExcept: {
        id: 'segments.accessLine.everyoneExcept',
        defaultMessage:
            'Everyone except {count, plural, one {# audience} other {# audiences}} can see it.'
    },
    only: {
        id: 'segments.accessLine.only',
        defaultMessage:
            'Only {count, plural, one {# audience} other {# audiences}} can see it'
    },
    onlyRule: {
        id: 'segments.accessLine.onlyRule',
        defaultMessage: '— “Not set” counts as “Cannot see”.'
    },
    howRules: {
        id: 'segments.entryTab.howRules',
        defaultMessage: 'How rules combine'
    }
});

type AccessLineProps = {
    /** The access as the next save will write it (staged edits included). */
    access: EntryAccess;
    /** Whether something is staged — the line then carries "Changed". */
    dirty: boolean;
    /** Whether the "How rules combine" disclosure is open. */
    rulesOpen: boolean;
    onToggleRules: () => void;
    /** The id of the disclosure's region, for `aria-controls`. */
    rulesId: string;
};

/**
 * The Access tab's lead: **one line** over the toolbar — the outcome, and the
 * one rule that is not obvious from the rows.
 *
 * - nothing set → "Public — every reader can see it.";
 * - only "Cannot see" → "Everyone except N audiences can see it.";
 * - any "Can see" → "Only N audiences can see it — “Not set” counts as
 *   “Cannot see”." The "Cannot see" rows need no words of their own there:
 *   they are already outside.
 *
 * Counts, not names. The rows below name every audience and their state, and
 * a sentence of names grew into a paragraph once an entry decided about thirty
 * of them. It reflects the **staged** state, like every control on the tab.
 * Not a live region: it never was, and the rows a change is made in announce
 * their own state.
 */
export function AccessLine({
    access,
    dirty,
    rulesOpen,
    onToggleRules,
    rulesId
}: AccessLineProps) {
    const intl = useIntl();
    const allowed = access.allow.length;
    const denied = access.deny.length;
    const restricted = allowed > 0 || denied > 0;
    const Icon = restricted ? Lock : Globe;

    return (
        <p
            data-testid="access-line"
            className="flex items-start gap-2 text-sm leading-5"
        >
            <Icon
                aria-hidden
                className="mt-0.5 size-4 shrink-0 text-muted-foreground"
            />
            <span className="min-w-0 flex-1">
                <span className="font-medium text-foreground">
                    {allowed > 0
                        ? intl.formatMessage(messages.only, { count: allowed })
                        : denied > 0
                          ? intl.formatMessage(messages.everyoneExcept, {
                                count: denied
                            })
                          : intl.formatMessage(messages.everyone)}
                </span>
                {allowed > 0 ? (
                    <span className="text-muted-foreground">
                        {' '}
                        {intl.formatMessage(messages.onlyRule)}
                    </span>
                ) : null}{' '}
                <button
                    type="button"
                    aria-expanded={rulesOpen}
                    aria-controls={rulesId}
                    onClick={onToggleRules}
                    className="whitespace-nowrap rounded-sm text-muted-foreground underline underline-offset-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                    {intl.formatMessage(messages.howRules)}
                </button>
            </span>
            {dirty ? <ChangedBadge /> : null}
        </p>
    );
}
