import { useId, type ReactNode, type Ref } from 'react';
import { Card, cn } from '@orthacms/design-system';

/**
 * One card on the member page: an `<h2>` header row — title, an optional
 * count, an optional action on the right — ruled off from its body. The
 * page's sections are all this shape (Profile, Recent activity, Workspaces,
 * Sign-in, Sessions, Password, Suspend), so they read as one set.
 */
export function MemberCard({
    title,
    count,
    action,
    tone = 'default',
    headingRef,
    children,
    className
}: {
    /** The section's heading (an `<h2>`). */
    title: ReactNode;
    /** A quiet number beside the title ("Sessions 2"). */
    count?: number;
    /** A control at the header's right end. */
    action?: ReactNode;
    /** `danger` borders the card in the destructive tone (Suspend). */
    tone?: 'default' | 'danger';
    /**
     * A ref on the heading, so a page can return focus to the section after
     * an action unmounts the control that had it.
     */
    headingRef?: Ref<HTMLHeadingElement>;
    children?: ReactNode;
    className?: string;
}) {
    const headingId = useId();
    return (
        <Card
            // A named region: the page is a set of these, and a screen reader's
            // landmark list then reads as the page's table of contents.
            role="region"
            aria-labelledby={headingId}
            className={cn(
                'overflow-hidden',
                tone === 'danger' && 'border-destructive/30',
                className
            )}
        >
            <div className="flex min-h-[52px] items-center gap-2 border-b px-4 py-2.5">
                <h2
                    id={headingId}
                    ref={headingRef}
                    tabIndex={headingRef ? -1 : undefined}
                    className="text-[15px] font-semibold outline-none"
                >
                    {title}
                </h2>
                {count !== undefined ? (
                    <span className="text-[13px] tabular-nums text-muted-foreground">
                        {count}
                    </span>
                ) : null}
                {action ? <div className="ml-auto">{action}</div> : null}
            </div>
            {children}
        </Card>
    );
}

/** One ruled row inside a {@link MemberCard}. */
export function MemberCardRow({
    children,
    className
}: {
    children: ReactNode;
    className?: string;
}) {
    return (
        <div
            className={cn(
                'flex min-h-12 items-center gap-3 border-b px-4 py-2.5 text-sm last:border-b-0',
                className
            )}
        >
            {children}
        </div>
    );
}
