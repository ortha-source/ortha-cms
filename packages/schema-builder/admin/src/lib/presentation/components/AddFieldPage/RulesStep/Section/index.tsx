import type { ReactNode } from 'react';

type Props = { id: string; title: string; hint: string; children: ReactNode };

/** One part of the rules step: a heading, a light line on what it is for, its editors. */
export function Section({ id, title, hint, children }: Props) {
    return (
        <section
            aria-labelledby={id}
            aria-describedby={`${id}-hint`}
            className="flex flex-col gap-4"
        >
            <div className="flex flex-col gap-1">
                <h3 id={id} className="text-sm font-semibold">
                    {title}
                </h3>
                <p id={`${id}-hint`} className="text-xs text-muted-foreground">
                    {hint}
                </p>
            </div>
            {children}
        </section>
    );
}
