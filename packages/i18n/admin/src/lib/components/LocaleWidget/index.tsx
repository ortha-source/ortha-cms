import type { ReactNode } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Info } from 'lucide-react';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Tooltip,
    TooltipContent,
    TooltipTrigger
} from '@ortha-cms/design-system';
import { useHasPermission } from '@ortha-cms/identity-admin';
import {
    ENTRY_MODE,
    type EntryStatus,
    type EntrySlotContext
} from '@ortha-cms/content-admin';
import {
    CONTENT_CREATE,
    LOCALE_GROUP_PARAM,
    LOCALE_PARAM
} from '../../constants';
import {
    isDefaultLocale,
    localeName,
    resolveActiveLocale
} from '../../domain/localePolicy';
import { useLocales } from '../../api/useLocales';
import { useEntryLocales } from '../../api/useEntryLocales';
import { useLocaleSummaries } from '../../api/useLocaleSummaries';
import { beginLocaleSwitch } from '../../utils/localeTransition';
import { LocaleSwitchOverlay } from '../LocaleSwitchOverlay';
import { LocaleRow } from './LocaleRow';

const messages = defineMessages({
    title: { id: 'i18n.widget.title', defaultMessage: 'Locale' },
    descriptionEdit: {
        id: 'i18n.widget.descriptionEdit',
        defaultMessage:
            'Switch between this record’s locales, or start a new translation.'
    },
    descriptionCreate: {
        id: 'i18n.widget.descriptionCreate',
        defaultMessage:
            'Choose the locale for this new record — or switch to one that already exists.'
    },
    groupIdLabel: {
        id: 'i18n.widget.groupIdLabel',
        defaultMessage: 'Translation group'
    },
    groupIdHelp: {
        id: 'i18n.widget.groupIdHelp',
        defaultMessage:
            'Every locale of this record shares one translation-group id — it’s how the CMS links a record’s translations together. Assigned automatically when the first locale is saved.'
    },
    groupIdHelpLabel: {
        id: 'i18n.widget.groupIdHelpLabel',
        defaultMessage: 'What is the translation group?'
    },
    groupIdPending: {
        id: 'i18n.widget.groupIdPending',
        defaultMessage: 'Assigned when this record is saved.'
    }
});

/** A group member resolved for one locale slug (its row id + publish status). */
type Sibling = { id: string; status?: EntryStatus };

/**
 * The entry editor's **locale switcher**, contributed into the sidebar widget
 * slot and styled like the Details block. It lists every configured locale: the
 * current one is marked, a locale whose translation already exists switches to
 * that sibling's editor (with its publish status), and a missing one is dimmed
 * but selectable — selecting it re-targets the form to that locale (same group).
 *
 * This works in **both** modes. On a **saved** record the group's members come
 * from `useEntryLocales`; a missing locale opens a draft create form scoped to
 * that locale + group. On a **new/unsaved** record you can still switch the
 * form's target locale before filling it in (re-scoping `?locale=` in place),
 * and — when the create is a translation into an existing group — jump to a
 * sibling that already exists (its members come from `useLocaleSummaries`).
 * Renders nothing for a non-i18n type.
 */
export function LocaleWidget({
    schema,
    entry,
    isCreate,
    mode,
    typePath
}: EntrySlotContext) {
    const intl = useIntl();
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const canCreate = useHasPermission(CONTENT_CREATE);
    const { locales, defaultLocale } = useLocales();

    const urlLocale = searchParams.get(LOCALE_PARAM) ?? undefined;
    const urlGroupId = searchParams.get(LOCALE_GROUP_PARAM) ?? undefined;

    // Edit mode lists the saved entry's group by its id; a create-into-group
    // (translation draft) reads the same members batched by the group id.
    const entryLocales = useEntryLocales(
        schema.name,
        entry?.id,
        !!schema.i18n && !isCreate && !!entry
    );
    const groupSummaries = useLocaleSummaries(
        schema.name,
        [urlGroupId],
        !!schema.i18n && isCreate && !!urlGroupId
    );

    if (!schema.i18n || locales.length === 0) return null;

    // No saved entry in create mode, so the target locale comes from the URL.
    const currentLocale =
        resolveActiveLocale({
            entryLocale: entry?.locale,
            urlLocale,
            defaultSlug: defaultLocale?.slug
        }) ?? '';
    const groupId = entry?.localeGroupId ?? urlGroupId;

    const card = (children: ReactNode) => (
        <Card className="border-border/60 bg-muted/20 shadow-none">
            <CardHeader>
                <CardTitle className="text-xs font-medium text-muted-foreground">
                    {intl.formatMessage(messages.title)}
                </CardTitle>
                <CardDescription>
                    {intl.formatMessage(
                        isCreate
                            ? messages.descriptionCreate
                            : messages.descriptionEdit
                    )}
                </CardDescription>
            </CardHeader>
            <CardContent>{children}</CardContent>
        </Card>
    );

    // The create route carries the target locale and — when translating into an
    // existing group — that group, so Save stamps the sibling. A fresh create
    // (no group) omits the group param entirely.
    const createSearch = (slug: string) => {
        const params = new URLSearchParams();
        params.set(LOCALE_PARAM, slug);
        if (groupId) params.set(LOCALE_GROUP_PARAM, groupId);
        return params.toString();
    };

    // The group's existing member in one locale (its id + status), or undefined.
    const siblingFor = (slug: string): Sibling | undefined => {
        if (isCreate) {
            const item = groupId
                ? groupSummaries.groups[groupId]?.find(
                      (member) => member.locale === slug
                  )
                : undefined;
            return item ? { id: item.entryId, status: item.status } : undefined;
        }
        const item = entryLocales.data?.items?.find(
            (candidate) => candidate.locale === slug
        );
        return item?.entry
            ? { id: item.entry.id, status: item.entry.status }
            : undefined;
    };

    // Switch to an existing locale, or re-target the form to a missing one
    // (same group). Singles re-resolve their one row via `?locale=`; collections
    // navigate to the sibling's id (or the create route for a new locale).
    const selectLocale = (slug: string, sibling?: Sibling) => {
        const name = localeName(locales, slug) ?? slug;
        // The draft's shared fields come from the source values: the saved
        // entry (edit mode), or whatever the create form already carries
        // (create mode — a translation draft's prefill), preserved as-is.
        const state = isCreate
            ? location.state
            : { translateFrom: entry?.values };
        // Play the switch flourish, then navigate **behind** the overlay once it
        // covers (see `beginLocaleSwitch`) so the editor doesn't visibly swap
        // under the blur. The module-level store carries the flourish across the
        // navigation so the destination editor's overlay host picks it up.
        beginLocaleSwitch(name, () => {
            if (mode === ENTRY_MODE.Single) {
                if (sibling) {
                    navigate(
                        isDefaultLocale(slug, defaultLocale?.slug)
                            ? typePath
                            : `${typePath}?${LOCALE_PARAM}=${slug}`
                    );
                } else {
                    navigate(`${typePath}?${createSearch(slug)}`, { state });
                }
                return;
            }
            if (sibling) {
                navigate(`${typePath}/${sibling.id}`);
            } else {
                navigate(`${typePath}/new?${createSearch(slug)}`, { state });
            }
        });
    };

    return (
        <>
            {card(
                <>
                    <ul className="flex flex-col gap-0.5">
                        {locales.map((locale) => {
                            const sibling = siblingFor(locale.slug);
                            const isCurrent = locale.slug === currentLocale;
                            // Existing → switch (any role); missing → create (gated).
                            const actionable =
                                !isCurrent && (!!sibling || canCreate);
                            return (
                                <LocaleRow
                                    key={locale.slug}
                                    name={locale.name}
                                    isCurrent={isCurrent}
                                    exists={!!sibling}
                                    status={sibling?.status}
                                    onSelect={
                                        actionable
                                            ? () =>
                                                  selectLocale(
                                                      locale.slug,
                                                      sibling
                                                  )
                                            : undefined
                                    }
                                />
                            );
                        })}
                    </ul>
                    {/* The translation-group id: shared by every locale of this
                        record. Shown with an info tooltip explaining what it is;
                        a fresh create (no group yet) shows a pending note. */}
                    <div className="mt-3 border-t border-border/60 pt-3">
                        <div className="flex items-center gap-1.5">
                            <span className="text-xs font-medium text-muted-foreground">
                                {intl.formatMessage(messages.groupIdLabel)}
                            </span>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button
                                        type="button"
                                        aria-label={intl.formatMessage(
                                            messages.groupIdHelpLabel
                                        )}
                                        className="inline-flex rounded text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    >
                                        <Info
                                            aria-hidden
                                            className="size-3.5"
                                        />
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-[16rem]">
                                    {intl.formatMessage(messages.groupIdHelp)}
                                </TooltipContent>
                            </Tooltip>
                        </div>
                        {groupId ? (
                            <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
                                {groupId}
                            </p>
                        ) : (
                            <p className="mt-1 text-xs italic text-muted-foreground">
                                {intl.formatMessage(messages.groupIdPending)}
                            </p>
                        )}
                    </div>
                </>
            )}
            <LocaleSwitchOverlay />
        </>
    );
}
