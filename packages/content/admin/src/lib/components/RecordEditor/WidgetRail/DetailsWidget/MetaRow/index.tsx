import type { ReactNode } from 'react';

/** A side-by-side label/value row in the {@link DetailsWidget}. */
export function MetaRow({
    label,
    children
}: {
    label: string;
    children: ReactNode;
}) {
    return (
        <div className="flex items-center justify-between gap-3">
            <dt className="text-[13px] text-muted-foreground">{label}</dt>
            <dd className="text-[13px]">{children}</dd>
        </div>
    );
}
