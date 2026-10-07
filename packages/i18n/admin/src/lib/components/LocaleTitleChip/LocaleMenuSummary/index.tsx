import { defineMessages, useIntl } from 'react-intl';

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
 * The locale menu's completion line: "N of M published · P%" over a thin
 * progress bar, under the search box.
 *
 * It used to lead with a strip of every locale code coloured by state. That
 * repeated the rows below it, and with two dozen locales it was four rows of
 * codes pushing the list — the actual control — half off the menu. The rows
 * already say each locale's state; this says only the total.
 *
 * The bar is `aria-hidden`; the sentence is what is read. While the group's
 * members are unknown no figure is claimed (`i18n:I-30`) and the bar stays
 * empty.
 */
export function LocaleMenuSummary({
    done,
    total,
    publishable,
    countKnown
}: {
    /** How many locales count toward completion. */
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
        <div className="flex items-center gap-3 px-1 pt-2.5">
            <div
                aria-hidden
                className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted"
            >
                <div
                    className="h-full rounded-full bg-success transition-[width]"
                    style={{ width: `${countKnown ? percent : 0}%` }}
                />
            </div>
            {countKnown ? (
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {intl.formatMessage(
                        publishable ? messages.published : messages.translated,
                        { done, total, percent }
                    )}
                </span>
            ) : null}
        </div>
    );
}
