import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import {
    Button,
    Input,
    Popover,
    PopoverContent,
    PopoverTrigger,
    cn
} from '@orthacms/design-system';
import { useHasPermission } from '@orthacms/identity-admin';
import { useUnsavedChangesApi } from '@orthacms/utils-admin';
import {
    ENTRY_MODE,
    type EntryStatus,
    type EntrySlotContext
} from '@orthacms/content-admin';
import {
    CONTENT_CREATE,
    LOCALE_GROUP_PARAM,
    LOCALE_PARAM
} from '../../constants';
import {
    isDefaultLocale,
    localeAttrs,
    localeName,
    resolveActiveLocale
} from '../../domain/localePolicy';
import { useLocales } from '../../api/useLocales';
import { useEntryLocales } from '../../api/useEntryLocales';
import { useLocaleSummaries } from '../../api/useLocaleSummaries';
import {
    beginLocaleSwitch,
    cancelPendingLocaleSwitch
} from '../../utils/localeTransition';
import { LocaleMenuSummary } from './LocaleMenuSummary';
import {
    LocaleMenuItem,
    type LocaleMenuItemInertReason
} from './LocaleMenuItem';

const messages = defineMessages({
    label: {
        id: 'i18n.title.currentLocale',
        defaultMessage: 'Current locale: {name}'
    },
    trigger: {
        id: 'i18n.localeMenu.trigger',
        defaultMessage:
            'Locale: {name}. {translated} of {total} translated. Choose a locale'
    },
    count: {
        id: 'i18n.localeMenu.count',
        defaultMessage: '{translated}/{total}'
    },
    localesUnavailable: {
        id: 'i18n.localeMenu.localesUnavailable',
        defaultMessage:
            'The configured locales couldn’t be loaded, so there is nothing to choose from.'
    },
    localesPending: {
        id: 'i18n.localeMenu.localesPending',
        defaultMessage: 'Loading locales…'
    },
    localesNone: {
        id: 'i18n.localeMenu.localesNone',
        defaultMessage: 'No locales are configured.'
    },
    localesRetry: {
        id: 'i18n.localeMenu.localesRetry',
        defaultMessage: 'Reload locales'
    },
    loadFailed: {
        id: 'i18n.widget.loadFailed',
        defaultMessage:
            'This record’s other locales couldn’t be loaded, so none are listed below. Some may already exist.'
    },
    retry: {
        id: 'i18n.widget.retry',
        defaultMessage: 'Try again'
    },
    search: {
        id: 'i18n.localeMenu.search',
        defaultMessage: 'Find a locale…'
    },
    list: {
        id: 'i18n.localeMenu.list',
        defaultMessage: 'Locales'
    },
    noMatch: {
        id: 'i18n.localeMenu.noMatch',
        defaultMessage: 'No locale matches “{query}”.'
    }
});

/** Case-insensitive match of the search query against a row's text. */
function matches(haystack: string, query: string): boolean {
    return haystack.toLowerCase().includes(query.trim().toLowerCase());
}

/**
 * What a read **is** right now — three states, never two.
 *
 * Both of this chip's reads have a window in which the answer is not yet known,
 * and collapsing that into the two states that *are* answers is how `i18n:I-30`
 * ("an error is not an emptiness") gets broken in the other direction: a
 * pending locale list reads as a failed one, and pending group members read as
 * "this locale has no translation" — an invitation to create a sibling that may
 * already exist, whose save then 409s. Naming the third state is the fix;
 * everything below branches on it rather than on a pair of booleans.
 */
type ReadState = 'pending' | 'failed' | 'known';

/** Classify a TanStack query's two flags into the three states above. */
function readState(query: { isPending: boolean; isError: boolean }): ReadState {
    // Error first: a retry leaves `isPending` false but the last answer is
    // still a failure, and a failure is the more specific thing to say.
    if (query.isError) return 'failed';
    return query.isPending ? 'pending' : 'known';
}

/** A group member resolved for one locale slug (its row id + publish status). */
type Sibling = {
    id: string;
    /** The row's title in its own language — edit mode only (see below). */
    title?: string;
    status?: EntryStatus;
    /** When this locale last went live — read with `status` for the badge. */
    publishedAt?: string | null;
};

/**
 * The chip beside the entry-editor title: which **locale** the open record is
 * in (the uppercased code and display name, e.g. `EN · English`), how much of
 * the translation group exists (`2/3`), and — as a menu — the way to any other
 * locale. Contributed into the content library's title-row slot; renders
 * nothing for a non-i18n type. The current locale is resolved by
 * `resolveActiveLocale`, the plugin's single decision point: the saved entry's
 * locale, else `?locale=`, else the default.
 *
 * The gate is the **schema**, not the locale list: on a saved localized record
 * the row's own `locale` is enough to name it, so a failed locale read costs
 * the display name and the choices — which the menu says, with a retry — not
 * the whole chip.
 *
 * It works in **both** modes. On a **saved** record the group's members come
 * from `useEntryLocales`; a missing locale opens a draft create form scoped to
 * that locale + group. On a **new/unsaved** record you can still switch the
 * form's target locale before filling it in (re-scoping `?locale=` in place),
 * and — when the create is a translation into an existing group — jump to a
 * sibling that already exists (its members come from `useLocaleSummaries`).
 *
 * The menu is a **searchable listbox** in a popover — the records toolbar's
 * `LocaleSwitcher` pattern: focus stays in the search box (`role="combobox"`),
 * ↑/↓ move an `aria-activedescendant` highlight, Enter picks. A deployment can
 * run two dozen locales, and a menu's type-ahead (first letter, one match at a
 * time) is no way to find "Portuguese (Brazil)" among them; the search matches
 * the name, the code and the record's title in that language.
 *
 * **Everything stateful lives here, not in the menu.** A pick does not navigate
 * immediately: `beginLocaleSwitch` schedules the swap behind the cover, and
 * `cancelPendingLocaleSwitch` (registered below as an unmount cleanup, so a
 * user who leaves in that window isn't yanked back) would kill it. The popover
 * content unmounts on close — inside that very window — so a cleanup
 * registered in there would cancel every pick made through it. This component
 * is mounted by the header slot and stays mounted across every open and close,
 * which is why it owns the queries, the permission, the guard, the search and
 * the timers, and `LocaleMenuItem` owns none of them.
 */
export function LocaleTitleChip({
    schema,
    entry,
    isCreate,
    mode,
    typePath,
    tabSegment,
    params
}: EntrySlotContext) {
    const intl = useIntl();
    const navigate = useNavigate();
    const location = useLocation();
    const guard = useUnsavedChangesApi();
    const canCreate = useHasPermission(CONTENT_CREATE);
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [activeIndex, setActiveIndex] = useState(0);
    const listId = useId();
    const triggerId = useId();
    const listRef = useRef<HTMLDivElement>(null);
    // Set by an arrow key, so only the keyboard scrolls the highlight into
    // view: doing it on hover too scrolls a half-visible row under the
    // pointer, which then hovers the next one, and so on to the end.
    const scrollToHighlight = useRef(false);
    // The pick waiting for the popover to finish closing (see `pick`).
    const pendingPick = useRef<(() => void) | null>(null);
    const {
        locales,
        defaultLocale,
        isPending: localesPending,
        isError: localesFailed,
        refetch: refetchConfiguredLocales
    } = useLocales();

    // The editor's own slot params, not `useSearchParams`: the entry-params
    // contribution already declares both keys, so this reads the values the
    // editor resolved rather than re-reading the URL beside it.
    const urlLocale = params[LOCALE_PARAM];
    const urlGroupId = params[LOCALE_GROUP_PARAM];

    // Edit mode lists the saved entry's group by its id; a create-into-group
    // (translation draft) reads the same members batched by the group id.
    const entryLocales = useEntryLocales(
        schema.name,
        entry?.id,
        !!schema.i18n && !isCreate && !!entry
    );
    // The menu's rows carry each locale's publish state, but they come from
    // this plugin's own query — which the content plugin's write mutations know
    // nothing about (they invalidate the content caches, not ours). So a save or
    // publish left the rows, and the chip's count, showing whatever they said
    // before it.
    //
    // The slot context's `entry` *is* refreshed by those mutations, so it is the
    // trigger. Keyed on **`updatedAt`, not `status`**: a write that leaves the
    // status where it was still changes the panel — saving twice in a row keeps
    // it `draft` both times, and editing a *shared* field rewrites the sibling
    // locales' rows without touching this one's status at all. `updatedAt` moves
    // on every write, so the rows can't go stale behind one.
    const entryUpdatedAt = entry?.updatedAt;
    const refetchLocales = entryLocales.refetch;
    useEffect(() => {
        if (!entryUpdatedAt) return;
        void refetchLocales();
    }, [entryUpdatedAt, refetchLocales]);

    const groupSummaries = useLocaleSummaries(
        schema.name,
        [urlGroupId],
        !!schema.i18n && isCreate && !!urlGroupId
    );

    // A pick schedules its navigation behind the cover. If the editor unmounts
    // in that window — the user clicked something else, which the overlay
    // deliberately lets through — the navigation is stale and must not fire.
    useEffect(() => cancelPendingLocaleSwitch, []);

    useEffect(() => {
        if (!scrollToHighlight.current) return;
        scrollToHighlight.current = false;
        listRef.current
            ?.querySelector('[data-highlighted]')
            ?.scrollIntoView({ block: 'nearest' });
    }, [activeIndex]);

    if (!schema.i18n) return null;

    const currentLocale = resolveActiveLocale({
        entryLocale: entry?.locale,
        urlLocale,
        defaultSlug: defaultLocale?.slug
    });
    if (!currentLocale) return null;

    const currentName = localeName(locales, currentLocale);
    const groupId = entry?.localeGroupId ?? urlGroupId;

    // The **configured** locale list: which locales exist at all.
    const localesState = readState({
        isPending: localesPending,
        isError: localesFailed
    });

    // The **group's members**: which of those locales this record exists in.
    //
    // An unfinished or failed group read leaves every locale resolving to
    // `undefined`, which renders as "no translation exists" — an invitation to
    // create a sibling that may already be there, whose save then 409s. Not-yet
    // and not-at-all are different answers and this menu has to say which one
    // it has (`i18n:I-30`).
    //
    // In create mode with no group there is genuinely nothing to read:
    // `useLocaleSummaries` reports itself idle rather than pending, so a fresh
    // create is `known` with no members — which is the truth.
    const membersState = readState(
        isCreate
            ? groupSummaries
            : {
                  isPending: entryLocales.isPending,
                  isError: entryLocales.isError
              }
    );
    const membersUnknown = membersState !== 'known';
    const entryItems = entryLocales.data?.items;

    // No extra request: edit mode already has one item per configured locale,
    // and create mode has the group's live members. `total` in create mode must
    // come from the **configured** list — a summary holds only live members, so
    // deriving it there would read `2/2` for a group missing two locales.
    const total = isCreate ? locales.length : (entryItems?.length ?? 0);
    const translated = isCreate
        ? groupId
            ? (groupSummaries.groups[groupId]?.length ?? 0)
            : 0
        : (entryItems?.filter((item) => !!item.entry).length ?? 0);
    // Withheld rather than guessed while the members are unknown: `0/4` on a
    // read that has not landed is the same lie the rows would tell
    // (`i18n:I-30`).
    const countKnown = !membersUnknown && total > 0;

    // The create route carries the target locale and — when translating into an
    // existing group — that group, so Save stamps the sibling. A fresh create
    // (no group) omits the group param entirely.
    const createSearch = (slug: string) => {
        const search = new URLSearchParams();
        search.set(LOCALE_PARAM, slug);
        if (groupId) search.set(LOCALE_GROUP_PARAM, groupId);
        return search.toString();
    };

    // The group's existing member in one locale (its id + status), or undefined.
    const siblingFor = (slug: string): Sibling | undefined => {
        if (isCreate) {
            const item = groupId
                ? groupSummaries.groups[groupId]?.find(
                      (member) => member.locale === slug
                  )
                : undefined;
            return item
                ? {
                      id: item.entryId,
                      status: item.status,
                      publishedAt: item.publishedAt
                  }
                : undefined;
        }
        const item = entryItems?.find((candidate) => candidate.locale === slug);
        return item?.entry
            ? {
                  id: item.entry.id,
                  title: item.entry.title,
                  status: item.entry.status,
                  publishedAt: item.entry.publishedAt
              }
            : undefined;
    };

    // How many locales count toward the summary's figure: **live** on a
    // publishable type (published, or Modified — live content with edits on
    // top), merely existing otherwise. None while the members are unknown.
    const isDone = (slug: string): boolean => {
        const sibling = siblingFor(slug);
        if (!sibling) return false;
        if (!schema.publishable) return true;
        return sibling.status === 'published' || !!sibling.publishedAt;
    };
    const doneCount = membersUnknown
        ? 0
        : locales.filter((locale) => isDone(locale.slug)).length;

    const selectLocale = (slug: string, sibling?: Sibling) => {
        const name = localeName(locales, slug) ?? slug;
        // The draft's shared fields come from the source values: the saved
        // entry (edit mode), or whatever the create form already carries
        // (create mode — a translation draft's prefill), preserved as-is.
        // `translateFromLocale` rides with the values: the shared fields are
        // about to be copied verbatim into a row of a *different* locale, and
        // the destination editor has no other way to know what language they
        // are actually in (WCAG 3.1.2 — `ORT-87`).
        const state = isCreate
            ? location.state
            : {
                  translateFrom: entry?.values,
                  translateFromLocale: entry?.locale
              };
        // Play the switch flourish, then navigate **behind** the overlay once it
        // covers (see `beginLocaleSwitch`) so the editor doesn't visibly swap
        // under the blur. The module-level store carries the flourish across the
        // navigation so the destination editor's overlay host picks it up.
        beginLocaleSwitch(name, () => {
            if (mode === ENTRY_MODE.Single) {
                if (sibling) {
                    navigate(
                        isDefaultLocale(slug, defaultLocale?.slug)
                            ? `${typePath}${tabSegment}`
                            : `${typePath}${tabSegment}?${LOCALE_PARAM}=${slug}`
                    );
                } else {
                    navigate(`${typePath}${tabSegment}?${createSearch(slug)}`, {
                        state
                    });
                }
                return;
            }
            if (sibling) {
                navigate(`${typePath}/${sibling.id}${tabSegment}`);
            } else {
                navigate(`${typePath}/new${tabSegment}?${createSearch(slug)}`, {
                    state
                });
            }
        });
    };

    // Switch to an existing locale, or re-target the form to a missing one
    // (same group). A switch leaves this record for another, so anything
    // unsaved is gone. Routed through the **app-wide** guard rather than a
    // local dialog, so this prompt is the same one every other navigation
    // shows, and so it outlives the menu that started it — the guard's dialog
    // is rendered by `UnsavedChangesProvider` at app level. The guard no-ops
    // when nothing is dirty (#36).
    const requestLocale = (slug: string, sibling?: Sibling) => {
        const run = () => selectLocale(slug, sibling);
        if (guard) guard.confirmNavigation(run);
        else run();
    };

    // Every configured locale with what the chip knows about it, narrowed by
    // the search. The record's own title in that language is searchable too —
    // a translator looking for "Winterstiefel" finds the German row by it.
    const rows = locales
        .map((locale) => {
            const sibling = siblingFor(locale.slug);
            const isCurrent = locale.slug === currentLocale;
            // Why a missing locale is inert, so the row reads as a stated state
            // rather than an unexplained ghost. Unknown members outrank
            // permission — we genuinely don't know whether it is missing — and
            // the two ways of not knowing are told apart, because "couldn't
            // load" on a read that is merely still running is the same false
            // claim in a smaller place.
            const inertReason: LocaleMenuItemInertReason | undefined =
                isCurrent || sibling
                    ? undefined
                    : membersState === 'pending'
                      ? 'pending'
                      : membersState === 'failed'
                        ? 'unknown'
                        : !canCreate
                          ? 'forbidden'
                          : undefined;
            // Existing → switch (any role); missing → create (gated). Nothing
            // is actionable while the members are unknown — **pending as much
            // as failed**: an "Add" we cannot stand behind is worse than no
            // affordance, and until the group read lands every sibling looks
            // missing whether it is or not.
            const actionable =
                !isCurrent && !membersUnknown && (!!sibling || canCreate);
            return { locale, sibling, isCurrent, inertReason, actionable };
        })
        .filter(({ locale, sibling }) =>
            matches(
                `${locale.slug} ${locale.name} ${sibling?.title ?? ''}`,
                query
            )
        );
    type Row = (typeof rows)[number];
    // Narrowing the search can leave the highlight past the end of the list,
    // which would make Enter a no-op.
    const highlight = Math.min(activeIndex, rows.length - 1);
    const optionId = (slug: string) => `${listId}-${slug}`;

    const pick = (row: Row) => {
        // Inert: nothing happened, so the menu stays open — closing it would
        // read as the pick having been taken.
        if (row.inertReason) return;
        // The current locale: there is nothing to switch to.
        if (!row.actionable) {
            setOpen(false);
            return;
        }
        // Run once the popover has closed and handed focus back to the trigger
        // (`onCloseAutoFocus` below). The unsaved-changes guard may open a
        // dialog with a focus trap of its own, and the closing popover's focus
        // restore must not land after it and fight it.
        pendingPick.current = () => requestLocale(row.locale.slug, row.sibling);
        setOpen(false);
    };

    const onSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (rows.length === 0) return;
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            scrollToHighlight.current = true;
            setActiveIndex((highlight + 1) % rows.length);
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            scrollToHighlight.current = true;
            setActiveIndex((highlight - 1 + rows.length) % rows.length);
        } else if (event.key === 'Enter') {
            const row = rows[highlight];
            if (!row) return;
            event.preventDefault();
            pick(row);
        }
    };

    return (
        <Popover
            open={open}
            onOpenChange={(next) => {
                setOpen(next);
                setQuery('');
                // Open on the current locale, so arrowing starts from where
                // the reader already is.
                if (next) {
                    setActiveIndex(
                        Math.max(
                            0,
                            locales.findIndex(
                                (locale) => locale.slug === currentLocale
                            )
                        )
                    );
                }
            }}
        >
            <PopoverTrigger asChild>
                {/* A plain outline `Button`, like the write actions it leads
                    in the top bar — not a badge: it is the editor's locale
                    switcher, and a chip read as a label about the record
                    rather than a control. */}
                <Button
                    id={triggerId}
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-label={
                        countKnown
                            ? intl.formatMessage(messages.trigger, {
                                  name: currentName ?? currentLocale,
                                  translated,
                                  total
                              })
                            : intl.formatMessage(messages.label, {
                                  name: currentName ?? currentLocale
                              })
                    }
                >
                    {currentLocale.toUpperCase()}
                    {/* The display name is written *in* that locale, so it
                        declares its own language and direction (`locale` is a
                        BCP-47 tag by contract). The uppercased code above is a
                        machine token and stays in the page's language.

                        The separator sits **outside** the marked span, in the
                        chip's own direction. Inside it, a right-to-left name
                        dragged the ` · ` to the wrong side of itself — the
                        separator belongs to the chip's layout, not to the name
                        (`ORT-86`). */}
                    {currentName ? (
                        <>
                            {' · '}
                            <span {...localeAttrs(locales, currentLocale)}>
                                {currentName}
                            </span>
                        </>
                    ) : null}
                    {countKnown ? (
                        <span className="font-normal text-muted-foreground">
                            {intl.formatMessage(messages.count, {
                                translated,
                                total
                            })}
                        </span>
                    ) : null}
                    <ChevronDown
                        aria-hidden
                        className="text-muted-foreground"
                    />
                </Button>
            </PopoverTrigger>
            <PopoverContent
                align="end"
                // Named by its trigger, which states the locale and the count —
                // better than a bare "Locales" would.
                aria-labelledby={triggerId}
                onCloseAutoFocus={() => {
                    const run = pendingPick.current;
                    pendingPick.current = null;
                    // After Radix's own focus restore, which runs right after
                    // this handler returns.
                    if (run) queueMicrotask(run);
                }}
                // Wide enough for a name, its code and a status on one line;
                // capped so a long locale list scrolls inside the popover (under
                // the search box) instead of off the screen.
                className="flex w-[28rem] max-w-[calc(100vw-2rem)] max-h-[min(32rem,var(--radix-popover-content-available-height))] flex-col p-0"
            >
                {membersState === 'failed' ? (
                    <div className="flex items-center gap-3 border-b px-3 py-2.5">
                        <p className="min-w-0 flex-1 text-sm text-destructive">
                            {intl.formatMessage(messages.loadFailed)}
                        </p>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="shrink-0"
                            onClick={() => {
                                if (isCreate) groupSummaries.refetch();
                                else void entryLocales.refetch();
                            }}
                        >
                            {intl.formatMessage(messages.retry)}
                        </Button>
                    </div>
                ) : null}
                {localesState === 'pending' ? (
                    // Still loading. It must **not** borrow either of the two
                    // branches below: the entry read can resolve before
                    // `GET /api/i18n/locales` on a deep link into an editor, so
                    // claiming a failure here means the menu asserts a broken
                    // config, and offers a retry for it, while the request is
                    // still in flight.
                    <p className="px-3 py-3 text-sm text-muted-foreground">
                        {intl.formatMessage(messages.localesPending)}
                    </p>
                ) : locales.length === 0 ? (
                    // Nothing to choose from — but *why* is two different
                    // answers, and the retry is only honest about one of them.
                    // A locale dropped from the host config while rows in it
                    // still exist is a real state (see the i18n dossier), and
                    // reading it as "couldn't load" sends the reader looking
                    // for a network fault that isn't there.
                    <div className="flex flex-col items-start gap-2 px-3 py-3">
                        <p
                            className={cn(
                                'text-sm',
                                localesState === 'failed'
                                    ? 'text-destructive'
                                    : 'text-muted-foreground'
                            )}
                        >
                            {intl.formatMessage(
                                localesState === 'failed'
                                    ? messages.localesUnavailable
                                    : messages.localesNone
                            )}
                        </p>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => refetchConfiguredLocales()}
                        >
                            {intl.formatMessage(messages.localesRetry)}
                        </Button>
                    </div>
                ) : (
                    <>
                        <div className="border-b p-2">
                            <Input
                                autoFocus
                                value={query}
                                onChange={(event) => {
                                    setQuery(event.target.value);
                                    setActiveIndex(0);
                                }}
                                onKeyDown={onSearchKeyDown}
                                placeholder={intl.formatMessage(
                                    messages.search
                                )}
                                aria-label={intl.formatMessage(messages.search)}
                                // `aria-activedescendant` is only honoured on
                                // a role that owns options — on a bare textbox
                                // the highlight moves silently.
                                role="combobox"
                                aria-expanded={rows.length > 0}
                                aria-haspopup="listbox"
                                aria-autocomplete="list"
                                aria-controls={listId}
                                aria-activedescendant={
                                    rows[highlight]
                                        ? optionId(rows[highlight].locale.slug)
                                        : undefined
                                }
                                className="h-8 rounded-lg shadow-none"
                            />
                            <LocaleMenuSummary
                                done={doneCount}
                                total={locales.length}
                                publishable={!!schema.publishable}
                                countKnown={!membersUnknown}
                            />
                        </div>
                        {rows.length === 0 ? (
                            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                                {intl.formatMessage(messages.noMatch, {
                                    query: query.trim()
                                })}
                            </p>
                        ) : (
                            // Only the list scrolls (a plain container, so the
                            // mouse wheel works); the search box stays put.
                            <div
                                ref={listRef}
                                id={listId}
                                role="listbox"
                                aria-label={intl.formatMessage(messages.list)}
                                className="min-h-0 flex-1 overflow-y-auto p-1"
                            >
                                {rows.map((row, index) => (
                                    <LocaleMenuItem
                                        key={row.locale.slug}
                                        id={optionId(row.locale.slug)}
                                        slug={row.locale.slug}
                                        name={row.locale.name}
                                        title={row.sibling?.title}
                                        nameAttrs={localeAttrs(
                                            locales,
                                            row.locale.slug
                                        )}
                                        isCurrent={row.isCurrent}
                                        exists={!!row.sibling}
                                        actionable={row.actionable}
                                        inertReason={row.inertReason}
                                        // Publish state is **publishable-only**:
                                        // an always-live type has no publish
                                        // workflow, so a "Draft" chip beside a
                                        // locale would name a state the type
                                        // doesn't have.
                                        status={
                                            schema.publishable
                                                ? row.sibling?.status
                                                : undefined
                                        }
                                        publishedAt={
                                            schema.publishable
                                                ? row.sibling?.publishedAt
                                                : undefined
                                        }
                                        highlighted={index === highlight}
                                        onHighlight={() =>
                                            setActiveIndex(index)
                                        }
                                        onSelect={() => pick(row)}
                                    />
                                ))}
                            </div>
                        )}
                    </>
                )}
            </PopoverContent>
        </Popover>
    );
}
