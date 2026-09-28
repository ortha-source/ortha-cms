import { defineMessages, useIntl } from 'react-intl';
import { Plus } from 'lucide-react';
import { DropdownMenuRadioItem, cn } from '@orthacms/design-system';
import { EntryStatusBadge, type EntryStatus } from '@orthacms/content-admin';

const messages = defineMessages({
    add: { id: 'i18n.widget.add', defaultMessage: 'Add' },
    switchLabel: {
        id: 'i18n.widget.switchLabel',
        defaultMessage: 'Switch to the {name} version'
    },
    addLabel: {
        id: 'i18n.widget.addLabel',
        defaultMessage: 'Create the {name} translation'
    },
    forbidden: {
        id: 'i18n.widget.forbiddenReason',
        defaultMessage: 'Not translated — you can’t create translations'
    },
    unknown: {
        id: 'i18n.widget.unknownReason',
        defaultMessage: 'Unknown — couldn’t load'
    },
    pending: {
        id: 'i18n.widget.pendingReason',
        defaultMessage: 'Checking…'
    },
    missing: {
        id: 'i18n.localeMenu.missing',
        defaultMessage: 'Missing'
    },
    notTranslated: {
        id: 'i18n.localeMenu.notTranslated',
        defaultMessage: 'Not translated'
    }
});

/**
 * Why a non-current locale's row carries no action.
 *
 * `pending` and `unknown` are **both** "we do not know whether a translation
 * exists", and are separate because only one of them is a fault: saying
 * "couldn't load" about a read that is still running sends the reader after a
 * problem that isn't there.
 */
export type LocaleMenuItemInertReason = 'forbidden' | 'unknown' | 'pending';

/** The stated reason for each way a row can be inert. */
const REASON_LABEL: Record<
    LocaleMenuItemInertReason,
    (typeof messages)[keyof typeof messages]
> = {
    forbidden: messages.forbidden,
    unknown: messages.unknown,
    pending: messages.pending
};

/**
 * One locale in the title chip's menu. The current locale is the **checked**
 * radio item; an **existing** sibling is a switch target (with its publish
 * status); a **missing** locale re-targets the form to it.
 *
 * **Purely presentational, and deliberately so.** This is the only thing
 * rendered inside `DropdownMenuContent`, which Radix unmounts the moment an
 * item is selected — while the switch it just started is still waiting out the
 * cover delay. So it owns no query, no timer, and above all **no unmount
 * cleanup**: `cancelPendingLocaleSwitch` here would cancel the very pick that
 * unmounted it. All of that lives in `LocaleTitleChip`, which stays mounted.
 *
 * An inert row **states why**, and is `aria-disabled` rather than `disabled`:
 * Radix skips a `disabled` item in arrow navigation, so the reason would be
 * unreachable for exactly the keyboard user who needs it. `onSelect` is
 * `preventDefault`ed instead, which also leaves the menu open.
 */
export function LocaleMenuItem({
    slug,
    name,
    title,
    nameAttrs,
    isCurrent,
    exists,
    status,
    publishedAt,
    inertReason,
    onSelect
}: {
    /** The locale's slug — the radio group's value for this row. */
    slug: string;
    /** Display name of the locale. */
    name: string;
    /**
     * The record's title in this locale, when the row exists and has one. It
     * is written in that language, so it takes `nameAttrs` too.
     */
    title?: string;
    /**
     * `lang`/`dir` for the name — it is written *in* the locale it names, so a
     * screen reader needs its language to pronounce it (WCAG 3.1.2) and an RTL
     * name needs its direction to order correctly.
     */
    nameAttrs?: { lang?: string; dir?: 'ltr' | 'rtl' };
    /** Whether this is the locale the editor currently has open. */
    isCurrent: boolean;
    /** Whether a translation exists in this locale. */
    exists: boolean;
    /** The sibling row's publish status (publishable types only). */
    status?: EntryStatus;
    /**
     * When that row last went live, or `null` — publishable types only. Read
     * with `status` by the shared classifier, so a locale carrying unpublished
     * edits over live content reads **Modified** instead of a bare "Draft".
     */
    publishedAt?: string | null;
    /** Why this row is inert, when it is. Rendered as the row's state. */
    inertReason?: LocaleMenuItemInertReason;
    /** Switch to / create this locale. Absent = not actionable. */
    onSelect?: () => void;
}) {
    const intl = useIntl();
    const missing = !exists && !isCurrent;
    const inert = !!inertReason;
    const actionable = !!onSelect && !isCurrent && !inert;
    // Missing *and* known to be: a pending or failed group read leaves every
    // locale looking missing, which the row must not assert (`i18n:I-30`).
    const knownMissing =
        missing && inertReason !== 'pending' && inertReason !== 'unknown';

    return (
        <DropdownMenuRadioItem
            value={slug}
            // The visible row carries a status badge and an "Add" hint, which
            // would join the accessible name as loose words. An actionable row
            // states what selecting it does instead.
            aria-label={
                actionable
                    ? intl.formatMessage(
                          exists ? messages.switchLabel : messages.addLabel,
                          { name }
                      )
                    : undefined
            }
            aria-disabled={inert || undefined}
            // Radix types ahead on the item's text, which here starts with
            // the code and the record title; the locale **name** is what a
            // reader types ("Deu…"), so it is the text to match.
            textValue={name}
            className="group/locale gap-3 py-2"
            onSelect={(event) => {
                if (!actionable) {
                    // Keep the menu open: nothing happened, and closing it
                    // would read as the pick having been taken.
                    if (inert) event.preventDefault();
                    return;
                }
                onSelect?.();
            }}
        >
            <span className="w-8 shrink-0 font-mono text-xs font-semibold uppercase">
                {slug}
            </span>
            <span className="min-w-0 flex-1">
                {/* The record in this language — what a translator is looking
                    for — over the language's own name. Without a title to show
                    the name leads alone; "Not translated" is said only when it
                    is known, never while the group is still loading. */}
                <span
                    className={cn(
                        'block truncate',
                        (missing || inert) && 'text-muted-foreground'
                    )}
                    {...(knownMissing ? {} : nameAttrs)}
                >
                    {title ??
                        (knownMissing
                            ? intl.formatMessage(messages.notTranslated)
                            : name)}
                </span>
                {title || knownMissing ? (
                    <span
                        className="block truncate text-xs text-muted-foreground"
                        {...nameAttrs}
                    >
                        {name}
                    </span>
                ) : null}
            </span>
            <span className="flex shrink-0 items-center gap-2">
                {status ? (
                    // `explainModified={false}`: this row **is** a control, and
                    // Modified's tooltip trigger is a `<button>` — nesting one
                    // inside a menu item is `nested-interactive`, a serious
                    // WCAG failure the row's own axe scan catches.
                    <EntryStatusBadge
                        entry={{ status, publishedAt }}
                        explainModified={false}
                    />
                ) : null}
                {missing && actionable ? (
                    <>
                        {/* "Add" replaces "Missing" on the highlighted row: the
                            state while scanning, the action once it is the
                            one a click would take. */}
                        <span className="rounded-full bg-destructive-soft px-2 py-0.5 text-xs font-medium text-destructive-soft-foreground group-data-[highlighted]/locale:hidden">
                            {intl.formatMessage(messages.missing)}
                        </span>
                        <span className="hidden items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium group-data-[highlighted]/locale:inline-flex">
                            <Plus aria-hidden className="size-3" />
                            {intl.formatMessage(messages.add)}
                        </span>
                    </>
                ) : null}
                {inertReason ? (
                    // Real text at full contrast, never `opacity-50` — halving
                    // the muted token measured 2.18:1, below AA, and said
                    // nothing about *why* the row was inert.
                    <span className="text-xs text-muted-foreground">
                        {intl.formatMessage(REASON_LABEL[inertReason])}
                    </span>
                ) : null}
            </span>
        </DropdownMenuRadioItem>
    );
}
