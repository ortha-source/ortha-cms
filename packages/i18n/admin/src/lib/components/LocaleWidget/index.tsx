import type { ReactNode } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle
} from '@ortha-cms/design-system';
import { useHasPermission } from '@ortha-cms/identity-admin';
import { ENTRY_MODE, type EntrySlotContext } from '@ortha-cms/content-admin';
import {
    CONTENT_CREATE,
    LOCALE_GROUP_PARAM,
    LOCALE_PARAM
} from '../../constants';
import { useLocales } from '../../api/useLocales';
import { useEntryLocales } from '../../api/useEntryLocales';
import { LocaleRow } from './LocaleRow';

const messages = defineMessages({
    title: { id: 'i18n.widget.title', defaultMessage: 'Locale' },
    createHint: {
        id: 'i18n.widget.createHint',
        defaultMessage: 'Save this record to add translations in other locales.'
    }
});

/**
 * The entry editor's **locale switcher**, contributed into the sidebar widget
 * slot and styled like the Details block. On a **saved** record it lists every
 * configured locale: the current one is marked, an existing translation
 * switches to that sibling's editor, and a missing one is dimmed but selectable
 * — selecting it opens a draft in that locale (same group), created when you
 * Save/Publish. On a **new/unsaved** record the other locales are disabled
 * until the base record is saved (there's no group to attach to yet). Renders
 * nothing for a non-i18n type.
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
    const [searchParams] = useSearchParams();
    const canCreate = useHasPermission(CONTENT_CREATE);
    const { locales, defaultLocale } = useLocales();
    // Only an existing entry has a group whose locales we can list.
    const entryLocales = useEntryLocales(
        schema.name,
        entry?.id,
        !!schema.i18n && !isCreate && !!entry
    );

    if (!schema.i18n || locales.length === 0) return null;

    const urlLocale = searchParams.get(LOCALE_PARAM) ?? undefined;
    const currentLocale =
        entry?.locale ?? urlLocale ?? defaultLocale?.slug ?? '';

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

    // Create mode (new record, or a translation-create in progress): only the
    // current locale is live; the rest are disabled until the record is saved.
    if (isCreate || !entry) {
        return card(
            <>
                <ul className="flex flex-col gap-0.5">
                    {locales.map((locale) => (
                        <LocaleRow
                            key={locale.slug}
                            name={locale.name}
                            isCurrent={locale.slug === currentLocale}
                            exists={false}
                            disabled={locale.slug !== currentLocale}
                        />
                    ))}
                </ul>
                <p className="mt-2 text-xs text-muted-foreground">
                    {intl.formatMessage(messages.createHint)}
                </p>
            </>
        );
    }

    const items = entryLocales.data?.items;
    const groupId = entry.localeGroupId;

    // Switch to an existing locale, or open a draft for a missing one (same
    // group). Singles re-resolve their one row via `?locale=`; collections
    // navigate to the sibling's id (or the create route for a new locale).
    const selectLocale = (
        slug: string,
        exists: boolean,
        siblingId?: string
    ) => {
        const createSearch = `${LOCALE_PARAM}=${slug}&${LOCALE_GROUP_PARAM}=${groupId ?? ''}`;
        // The source values seed the draft; the create form keeps only the
        // non-localized (shared) fields.
        const state = { translateFrom: entry.values };
        if (mode === ENTRY_MODE.Single) {
            if (exists) {
                navigate(
                    slug === defaultLocale?.slug
                        ? typePath
                        : `${typePath}?${LOCALE_PARAM}=${slug}`
                );
            } else {
                navigate(`${typePath}?${createSearch}`, { state });
            }
            return;
        }
        if (exists && siblingId) {
            navigate(`${typePath}/${siblingId}`);
        } else {
            navigate(`${typePath}/new?${createSearch}`, { state });
        }
    };

    return card(
        <ul className="flex flex-col gap-0.5">
            {locales.map((locale) => {
                const item = items?.find(
                    (candidate) => candidate.locale === locale.slug
                );
                const exists = !!item?.entry;
                const isCurrent = locale.slug === currentLocale;
                // Existing → switch (any role); missing → create (gated).
                const actionable = !isCurrent && (exists || canCreate);
                return (
                    <LocaleRow
                        key={locale.slug}
                        name={locale.name}
                        isCurrent={isCurrent}
                        exists={exists}
                        status={item?.entry?.status}
                        onSelect={
                            actionable
                                ? () =>
                                      selectLocale(
                                          locale.slug,
                                          exists,
                                          item?.entry?.id
                                      )
                                : undefined
                        }
                    />
                );
            })}
        </ul>
    );
}
