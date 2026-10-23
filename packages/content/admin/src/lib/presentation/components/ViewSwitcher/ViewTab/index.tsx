import type { ReactNode } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { Pin, Users } from 'lucide-react';
import { cn } from '@orthacms/design-system';

/** Intl descriptors for {@link ViewTab}, co-located. */
const messages = defineMessages({
    modified: {
        id: 'content.views.tab.modified',
        defaultMessage: 'Modified'
    },
    shared: {
        id: 'content.views.tab.shared',
        defaultMessage: 'Shared with the workspace'
    },
    defaultView: {
        id: 'content.views.tab.default',
        defaultMessage: 'Your default view'
    }
});

/** Props for {@link ViewTab}. */
export type ViewTabProps = {
    /** The tab's label — a view's name, or "All records". */
    children: ReactNode;
    /** The slice on screen. */
    active: boolean;
    /** The live list has drifted from this (active) view's saved payload. */
    dirty?: boolean;
    /** A view shared with the workspace rather than a personal one. */
    shared?: boolean;
    /** The reader's default view. */
    isDefault?: boolean;
    /** Applies the slice. */
    onSelect: () => void;
};

/**
 * One saved view as a tab over the records table. A **button** with
 * `aria-pressed`, not a link or an ARIA tab: picking one rewrites the list's
 * URL params in place (`replace`), the same act as any other toolbar control,
 * and there is no tab panel to own. The active one is underlined like the
 * page's other tabs; a modified one carries a dot, said in words to a screen
 * reader.
 */
export function ViewTab({
    children,
    active,
    dirty = false,
    shared = false,
    isDefault = false,
    onSelect
}: ViewTabProps) {
    const intl = useIntl();
    return (
        <button
            type="button"
            aria-pressed={active}
            onClick={onSelect}
            className={cn(
                'relative inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 text-[13px] text-muted-foreground outline-none transition-colors',
                'hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring',
                'after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full',
                active && 'font-medium text-foreground after:bg-foreground'
            )}
        >
            {shared ? (
                <Users
                    aria-label={intl.formatMessage(messages.shared)}
                    className="size-3.5 text-muted-foreground"
                />
            ) : null}
            <span className="max-w-[12rem] truncate">{children}</span>
            {isDefault ? (
                <Pin
                    aria-label={intl.formatMessage(messages.defaultView)}
                    className="size-3 text-muted-foreground"
                />
            ) : null}
            {dirty ? (
                <>
                    <span
                        aria-hidden
                        className="size-1.5 rounded-full bg-warning"
                    />
                    <span className="sr-only">
                        {intl.formatMessage(messages.modified)}
                    </span>
                </>
            ) : null}
        </button>
    );
}
