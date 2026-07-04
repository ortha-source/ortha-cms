import type { ReactNode } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle
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
import { useLocales } from '../../api/useLocales';
import { useEntryLocales } from '../../api/useEntryLocales';
import { useLocaleSummaries } from '../../api/useLocaleSummaries';
import { LocaleRow } from './LocaleRow';

const messages = defineMessages({
    title: { id: 'i18n.widget.title', defaultMessage: 'Locale' }
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
        entry?.locale ?? urlLocale ?? defaultLocale?.slug ?? '';
    const groupId = entry?.localeGroupId ?? urlGroupId;

    const card = (children: ReactNode) => (
        <Card className="border-border/60 bg-muted/20 shadow-none">
            <CardHeader>
                <CardTitle className="text-xs font-medium text-muted-foreground">
                    {intl.formatMessage(messages.title)}
                </CardTitle>
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
        // The draft's shared fields come from the source values: the saved
        // entry (edit mode), or whatever the create form already carries
        // (create mode — a translation draft's prefill), preserved as-is.
        const state = isCreate
            ? location.state
            : { translateFrom: entry?.values };
        if (mode === ENTRY_MODE.Single) {
            if (sibling) {
                navigate(
                    slug === defaultLocale?.slug
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
    };

    return card(
        <ul className="flex flex-col gap-0.5">
            {locales.map((locale) => {
                const sibling = siblingFor(locale.slug);
                const isCurrent = locale.slug === currentLocale;
                // Existing → switch (any role); missing → create (gated).
                const actionable = !isCurrent && (!!sibling || canCreate);
                return (
                    <LocaleRow
                        key={locale.slug}
                        name={locale.name}
                        isCurrent={isCurrent}
                        exists={!!sibling}
                        status={sibling?.status}
                        onSelect={
                            actionable
                                ? () => selectLocale(locale.slug, sibling)
                                : undefined
                        }
                    />
                );
            })}
        </ul>
    );
}
