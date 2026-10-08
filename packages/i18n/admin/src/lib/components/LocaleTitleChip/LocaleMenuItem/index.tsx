import { defineMessages, useIntl } from 'react-intl';
import { Check, Plus } from 'lucide-react';
import { cn } from '@orthacms/design-system';
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
    default: {
        id: 'i18n.localeMenu.default',
        defaultMessage: 'Default'
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
 * One locale in the title chip's menu — an `option` of its listbox. The current
 * locale is the **selected** option; an **existing** sibling is a switch target
 * (with its publish status); a **missing** locale re-targets the form to it.
 *
 * The row leads with the language **name**, the code beside it on the same
 * line, and the record's title in that language beneath when there is one. The
 * name is what a reader scans and searches for; the code used to sit in a
 * fixed narrow column of its own, where anything longer than `de-DE` broke
 * across two lines.
 *
 * **Purely presentational, and deliberately so.** Focus never leaves the
 * search box: the chip moves an `aria-activedescendant` highlight over these
 * rows (`tabIndex={-1}`, so two dozen locales aren't a Tab gauntlet) and owns
 * every query, timer and cleanup — the popover content unmounts on every close,
 * including the one a pick causes.
 *
 * The **default** locale is pinned first by the chip and set apart here: a
 * tinted row, a "Default" tag, and a divider beneath it, so the source most
 * translations start from is found without reading the list.
 *
 * An inert row **states why**, and is `aria-disabled` rather than absent from
 * the highlight order, so the reason is reachable for the keyboard user who
 * needs it.
 */
export function LocaleMenuItem({
    id,
    slug,
    name,
    title,
    nameAttrs,
    isCurrent,
    isDefault,
    exists,
    actionable,
    status,
    publishedAt,
    inertReason,
    highlighted,
    onHighlight,
    onSelect
}: {
    /** DOM id — the target of the search box's `aria-activedescendant`. */
    id: string;
    /** The locale's slug, shown beside the name. */
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
    /** Whether this is the deployment's default locale. */
    isDefault: boolean;
    /** Whether a translation exists in this locale. */
    exists: boolean;
    /** Whether picking this row switches to it or creates it. */
    actionable: boolean;
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
    /** Whether the keyboard/pointer highlight is on this row. */
    highlighted: boolean;
    /** Move the highlight here (pointer hover). */
    onHighlight: () => void;
    /** Pick this row — the chip decides whether that does anything. */
    onSelect: () => void;
}) {
    const intl = useIntl();
    const missing = !exists && !isCurrent;
    const inert = !!inertReason;

    return (
        <button
            id={id}
            type="button"
            role="option"
            tabIndex={-1}
            aria-selected={isCurrent}
            aria-disabled={inert || undefined}
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
            data-highlighted={highlighted ? '' : undefined}
            onMouseMove={highlighted ? undefined : onHighlight}
            // Keep focus in the search box: a pointer pick must not move it
            // onto a row the keyboard contract never focuses.
            onMouseDown={(event) => event.preventDefault()}
            onClick={onSelect}
            className={cn(
                'group/locale flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm outline-none',
                // The default row is tinted at rest, and sits above a divider
                // drawn by its margin + border, so it reads as the anchor of
                // the list rather than its first entry.
                isDefault &&
                    'relative mb-1.5 bg-muted/70 after:absolute after:inset-x-1 after:-bottom-1 after:border-b after:border-border after:content-[""]',
                'data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground',
                inert && 'cursor-default'
            )}
        >
            <Check
                aria-hidden
                className={cn(
                    'size-4 shrink-0',
                    isCurrent ? 'opacity-100' : 'opacity-0'
                )}
            />
            <span className="min-w-0 flex-1">
                <span className="flex min-w-0 items-baseline gap-2">
                    <span
                        className={cn(
                            'truncate',
                            missing || inert
                                ? 'text-muted-foreground'
                                : 'font-medium'
                        )}
                        {...nameAttrs}
                    >
                        {name}
                    </span>
                    <span className="shrink-0 whitespace-nowrap font-mono text-xs text-muted-foreground uppercase">
                        {slug}
                    </span>
                    {isDefault ? (
                        <span className="shrink-0 rounded border bg-background px-1.5 text-[0.6875rem] leading-4 font-medium text-muted-foreground">
                            {intl.formatMessage(messages.default)}
                        </span>
                    ) : null}
                </span>
                {title ? (
                    // The record in this language — what a translator is
                    // looking for once they have found the language.
                    <span
                        className="block truncate text-xs text-muted-foreground"
                        {...nameAttrs}
                    >
                        {title}
                    </span>
                ) : null}
            </span>
            <span className="flex shrink-0 items-center gap-2">
                {status ? (
                    // `explainModified={false}`: this row **is** a control, and
                    // Modified's tooltip trigger is a `<button>` — nesting one
                    // inside an option is `nested-interactive`, a serious WCAG
                    // failure the menu's own axe scan catches.
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
                        <span className="hidden items-center gap-1 rounded-full border bg-background px-2 py-0.5 text-xs font-medium group-data-[highlighted]/locale:inline-flex">
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
        </button>
    );
}
