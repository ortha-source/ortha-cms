import { defineMessages, useIntl } from 'react-intl';
import { DropdownMenuLabel, cn } from '@orthacms/design-system';

const messages = defineMessages({
    published: {
        id: 'i18n.localeMenu.summaryPublished',
        defaultMessage: '{done} of {total} published · {percent}%'
    },
    translated: {
        id: 'i18n.localeMenu.summaryTranslated',
        defaultMessage: '{done} of {total} translated · {percent}%'
    }
});

/**
 * How one locale reads in the header strip:
 * - `done` — counts toward the summary (published on a publishable type,
 *   merely existing on one with no publish workflow);
 * - `present` — exists but does not count yet (a draft);
 * - `missing` — no translation;
 * - `unknown` — the group's members have not loaded (or failed to).
 */
export type LocaleChipState = 'done' | 'present' | 'missing' | 'unknown';

/** One locale in the header strip. */
export type LocaleChip = {
    slug: string;
    state: LocaleChipState;
    isCurrent: boolean;
};

/** The chip look per state — filled when it counts, outlined when it does not. */
const CHIP_CLASS: Record<LocaleChipState, string> = {
    done: 'border-transparent bg-foreground text-background',
    present: 'border-foreground/40 bg-secondary text-foreground',
    missing: 'border-border bg-background text-muted-foreground',
    unknown: 'border-dashed border-border bg-background text-muted-foreground'
};

/**
 * The locale menu's summary: a strip of locale codes coloured by how far each
 * translation has got, the completion figure, and a progress bar.
 *
 * It is an **overview**, not a second way to pick: the rows below are the
 * controls, and every fact here is repeated on its row. So the strip and the
 * bar are `aria-hidden` and only the sentence is read — twenty-four codes
 * announced one by one would bury the menu under its own summary.
 *
 * The strip wraps — twenty-four locales is three short rows — and only past
 * about five rows does it scroll within a capped height, so a very large
 * deployment still keeps the rows, not the chips, on screen. The `p-1` / `-m-1`
 * pair makes room for the current chip's focus-style ring, which the scroll
 * container would otherwise clip.
 */
export function LocaleMenuHeader({
    chips,
    done,
    total,
    publishable,
    countKnown
}: {
    chips: LocaleChip[];
    /** How many locales count toward completion (see {@link LocaleChipState}). */
    done: number;
    total: number;
    /** Whether "done" means published (else: translated). */
    publishable: boolean;
    /** Whether the group's members are known — else no figure is claimed. */
    countKnown: boolean;
}) {
    const intl = useIntl();
    const percent = total > 0 ? Math.round((done / total) * 100) : 0;

    return (
        <DropdownMenuLabel className="sticky -top-1 z-10 -mx-1 -mt-1 mb-1 border-b bg-popover px-3 pt-3 pb-2.5 font-normal">
            <div className="flex items-start gap-3">
                <ul
                    aria-hidden
                    className="flex -m-1 max-h-[7.5rem] min-w-0 flex-1 flex-wrap gap-1.5 overflow-y-auto p-1"
                >
                    {chips.map((chip) => (
                        <li
                            key={chip.slug}
                            className={cn(
                                'rounded-full border px-2 py-0.5 font-mono text-[0.6875rem] font-semibold leading-4 uppercase',
                                CHIP_CLASS[chip.state],
                                chip.isCurrent &&
                                    'ring-2 ring-ring ring-offset-1 ring-offset-popover'
                            )}
                        >
                            {chip.slug}
                        </li>
                    ))}
                </ul>
                {countKnown ? (
                    <span className="shrink-0 pt-0.5 text-xs text-muted-foreground tabular-nums">
                        {intl.formatMessage(
                            publishable
                                ? messages.published
                                : messages.translated,
                            { done, total, percent }
                        )}
                    </span>
                ) : null}
            </div>
            <div
                aria-hidden
                className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-muted"
            >
                <div
                    className="h-full rounded-full bg-success transition-[width]"
                    style={{ width: `${countKnown ? percent : 0}%` }}
                />
            </div>
        </DropdownMenuLabel>
    );
}
