import type { ReactNode } from 'react';

/**
 * One label/value line in the detail drawer's metadata list — a muted term on
 * the left and its value on the right, aligned as a `dt`/`dd` pair. Purely
 * presentational; the drawer supplies localized labels and formatted values.
 */
export function MetaRow({
    label,
    children
}: {
    label: ReactNode;
    children: ReactNode;
}) {
    return (
        <div className="flex items-start justify-between gap-4 py-2">
            <dt className="shrink-0 text-sm text-muted-foreground">{label}</dt>
            <dd className="min-w-0 truncate text-right text-sm font-medium">
                {children}
            </dd>
        </div>
    );
}
