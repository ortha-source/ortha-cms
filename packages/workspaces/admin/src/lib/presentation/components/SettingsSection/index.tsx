import type { ReactNode } from 'react';
import { cn } from '@orthacms/design-system';

/** Props for {@link SettingsSection}. */
export type SettingsSectionProps = {
    /** The `<h2>`'s id, and the section's accessible name. */
    id: string;
    /** The section's heading. */
    title: string;
    /** One sentence under it. */
    description?: string;
    /** Something trailing the heading (a count, a badge). */
    aside?: ReactNode;
    /** The fields. */
    children: ReactNode;
    /** Extra classes for the body (a list that draws its own padding). */
    bodyClassName?: string;
};

/**
 * One framed block of a settings section: an `<h2>` and a sentence over its
 * fields, so where one question ends and the next begins is drawn — the shape
 * the webhook editor's sections have, at the same 720px measure.
 */
export function SettingsSection({
    id,
    title,
    description,
    aside,
    children,
    bodyClassName
}: SettingsSectionProps) {
    return (
        <section
            aria-labelledby={id}
            className="rounded-xl border bg-card text-card-foreground"
        >
            <header className="flex items-start gap-3 border-b px-5 py-3.5">
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <h2
                        id={id}
                        tabIndex={-1}
                        className="text-[15px] font-semibold leading-5 focus:outline-none"
                    >
                        {title}
                    </h2>
                    {description ? (
                        <p className="text-[13px] text-muted-foreground">
                            {description}
                        </p>
                    ) : null}
                </div>
                {aside}
            </header>
            <div className={cn('flex flex-col gap-5 p-5', bodyClassName)}>
                {children}
            </div>
        </section>
    );
}
