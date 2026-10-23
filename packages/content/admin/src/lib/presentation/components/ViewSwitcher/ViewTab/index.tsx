import type { ComponentPropsWithoutRef, ReactNode, Ref } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { Star, Users } from 'lucide-react';
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
export type ViewTabProps = Omit<
    ComponentPropsWithoutRef<'button'>,
    'children' | 'onSelect'
> & {
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
    /** Room on the right for a ▾ drawn over the tab's end. */
    withCaret?: boolean;
    buttonRef?: Ref<HTMLButtonElement>;
};

/**
 * One saved view as a tab over the records table. A **button** with
 * `aria-pressed`, not a link or an ARIA tab: picking one rewrites the list's
 * URL params in place (`replace`), the same act as any other toolbar control,
 * and there is no tab panel to own. The active one is underlined like the
 * page's other tabs; a modified one carries a dot, said in words to a screen
 * reader. A star marks the reader's default, a people glyph a shared view.
 *
 * Other button props (`onContextMenu`, `onKeyDown`, `onDoubleClick`) pass
 * through — `SavedViewTab` hangs the view's menu and rename off them.
 */
export function ViewTab({
    children,
    active,
    dirty = false,
    shared = false,
    isDefault = false,
    onSelect,
    withCaret = false,
    buttonRef,
    className,
    ...props
}: ViewTabProps) {
    const intl = useIntl();
    return (
        <button
            {...props}
            ref={buttonRef}
            type="button"
            aria-pressed={active}
            // The second click of a double-click is the rename's, not
            // another select (or, on the selected tab, the menu's).
            onClick={(event) => {
                if (event.detail > 1) return;
                onSelect();
            }}
            className={cn(
                'relative inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 text-[13px] text-muted-foreground outline-none transition-colors',
                'hover:text-foreground focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                'after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full',
                active && 'font-medium text-foreground after:bg-foreground',
                withCaret && 'pr-7',
                className
            )}
        >
            {isDefault ? (
                <Star
                    aria-label={intl.formatMessage(messages.defaultView)}
                    className="size-3.5 fill-amber-400 text-amber-500"
                />
            ) : null}
            {shared ? (
                <Users
                    aria-label={intl.formatMessage(messages.shared)}
                    className="size-3.5 text-muted-foreground"
                />
            ) : null}
            <span className="max-w-[12rem] truncate">{children}</span>
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
