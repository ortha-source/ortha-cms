import { cn } from '@orthacms/design-system';

/** Where one locale of the record stands, as its dot draws it. */
export type LocaleDotState = 'published' | 'modified' | 'draft' | 'missing';

/** Each state's dot: filled by publish state, hollow where nothing exists. */
const DOT: Record<LocaleDotState, string> = {
    published: 'bg-success',
    modified: 'bg-warning',
    draft: 'bg-muted-foreground/60',
    missing: 'border border-muted-foreground/50 bg-transparent'
};

/**
 * One dot per workspace locale, in the menu's order, coloured by where the
 * record stands in it — published, live with changes, draft, not created
 * (`docs/design/entry-editor.md`, _Locale switcher_). It replaces the
 * "2/3" count, which said how many but not which.
 *
 * Decorative: the trigger's accessible name already spells the count out,
 * and the popover lists every locale with its badge in words.
 */
export function LocaleDots({
    states
}: {
    states: { slug: string; state: LocaleDotState }[];
}) {
    return (
        <span
            aria-hidden
            data-testid="locale-dots"
            className="flex items-center gap-0.5"
        >
            {states.map(({ slug, state }) => (
                <span
                    key={slug}
                    data-state={state}
                    className={cn('size-1.5 rounded-full', DOT[state])}
                />
            ))}
        </span>
    );
}
