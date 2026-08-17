import * as React from 'react';
import { Search } from 'lucide-react';

import { Spinner } from './spinner';

import { cn } from '../../utils';
import { InputGroup, InputGroupAddon, InputGroupInput } from './input-group';

/** Props for {@link SearchToolbar}. */
export type SearchToolbarProps = {
    /** Current search-box value. */
    value: string;
    /** Called with the raw input value on every keystroke. */
    onValueChange: (value: string) => void;
    /** Accessible label for the search box (consumer-localised). */
    searchLabel: string;
    /** Placeholder for the search box (consumer-localised). */
    searchPlaceholder?: string;
    /**
     * Trailing controls — e.g. a filter-drawer trigger. Rendered flush to the
     * **right** edge of the toolbar so primary actions/filters sit opposite the
     * search box. i18n is the consumer's concern, kept out of this primitive.
     */
    actions?: React.ReactNode;
    /**
     * Whether a request driven by this toolbar is in flight. Swaps the leading
     * magnifier for a spinner, so a list that keeps its previous rows while
     * refetching still shows that something is happening. Purely visual — the
     * list owns the announcement (its own live region says "Loading…").
     */
    busy?: boolean;
    /**
     * Ref to the search `<input>`. Lets a page restore focus to it after an
     * action destroys the control the user activated — e.g. a "Clear filters"
     * button that lives inside the empty state it unmounts, which otherwise
     * drops focus to `<body>` (WCAG 2.4.3).
     */
    inputRef?: React.Ref<HTMLInputElement>;
    className?: string;
};

/**
 * The standard list-page toolbar: a leading search box and an optional cluster
 * of trailing actions pinned to the right. Shared across admin list pages so
 * the search/filter layout stays identical everywhere; copy-free and i18n-free,
 * configured entirely by the consumer (mirrors the wizard chrome convention).
 */
export function SearchToolbar({
    value,
    onValueChange,
    searchLabel,
    searchPlaceholder,
    actions,
    busy = false,
    inputRef,
    className
}: SearchToolbarProps) {
    return (
        <div
            className={cn('mb-4 flex flex-wrap items-center gap-3', className)}
        >
            <InputGroup className="w-full shadow-none sm:max-w-[360px]">
                <InputGroupAddon>
                    {busy ? (
                        <Spinner aria-hidden className="size-4" />
                    ) : (
                        <Search />
                    )}
                </InputGroupAddon>
                <InputGroupInput
                    ref={inputRef}
                    type="search"
                    value={value}
                    onChange={(event) => onValueChange(event.target.value)}
                    aria-label={searchLabel}
                    placeholder={searchPlaceholder}
                />
            </InputGroup>
            {actions ? <div className="ml-auto">{actions}</div> : null}
        </div>
    );
}
