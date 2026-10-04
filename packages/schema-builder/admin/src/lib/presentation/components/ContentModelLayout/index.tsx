import type { ReactNode } from 'react';

type Props = { rail: ReactNode; editor: ReactNode };

/**
 * Two panes: the types, the selected type. One grid for the page and its
 * skeleton — identical columns are what makes the swap invisible.
 */
export function ContentModelLayout({ rail, editor }: Props) {
    return (
        <div className="mt-6 grid gap-5 lg:grid-cols-[15rem_minmax(0,1fr)]">
            <div className="min-w-0">{rail}</div>
            <div className="min-w-0">{editor}</div>
        </div>
    );
}
