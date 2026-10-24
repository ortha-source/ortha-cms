import type { ReactNode } from 'react';

type Props = { rail: ReactNode; editor: ReactNode };

/**
 * Two panes over the whole work area: the types as a column running its full
 * height, ruled off on the right, and the selected type beside it. One layout
 * for the page and its skeleton — identical columns are what makes the swap
 * invisible. Below `lg` the rail stacks over the editor.
 */
export function ContentModelLayout({ rail, editor }: Props) {
    return (
        <div className="flex flex-1 flex-col lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]">
            <div className="min-w-0 border-b lg:border-b-0 lg:border-r">
                {rail}
            </div>
            <div className="min-w-0 px-4 py-6 sm:px-8 lg:py-8">
                <div className="mx-auto flex w-full max-w-[880px] flex-col gap-5">
                    {editor}
                </div>
            </div>
        </div>
    );
}
