import { Link, useMatch } from 'react-router-dom';
import { defineMessages, useIntl } from 'react-intl';
import { Inbox } from 'lucide-react';
import { buttonVariants, cn } from '@orthacms/design-system';
import { useInboxSummary } from '../../../application/hooks';

const messages = defineMessages({
    label: {
        id: 'inbox.headerButton.label',
        defaultMessage:
            '{count, plural, =0 {Inbox} one {Inbox, # unread} other {Inbox, # unread}}'
    }
});

/**
 * The inbox's way in from **inside** a workspace: an icon button in the
 * workspace sidebar's header, beside "← Home" (`WORKSPACE_NAV_HEADER_ACTION_SLOT`).
 * The workspace's own counts are on its Reviews and Alarms rows; this one is
 * how somebody working here hears about the others. Its name carries the
 * count; the chip on the icon is decoration.
 */
export function InboxHeaderButton() {
    const intl = useIntl();
    const { data } = useInboxSummary();
    const count = data?.unread ?? 0;
    const active = Boolean(useMatch('/inbox/*'));
    return (
        <Link
            to="/inbox"
            aria-current={active ? 'page' : undefined}
            aria-label={intl.formatMessage(messages.label, { count })}
            title={intl.formatMessage(messages.label, { count })}
            className={cn(
                buttonVariants({ variant: 'ghost', size: 'icon' }),
                'relative size-7 text-sidebar-foreground/70'
            )}
        >
            <Inbox className="size-4" aria-hidden />
            {count > 0 ? (
                <span
                    aria-hidden
                    className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full border-2 border-sidebar bg-primary px-1 text-[9px] font-bold leading-none text-primary-foreground tabular-nums"
                >
                    {count > 99 ? '99+' : count}
                </span>
            ) : null}
        </Link>
    );
}
