import { useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    toast
} from '@ortha-cms/design-system';
import { useHasPermission } from '@ortha-cms/identity-admin';
import { ENTRY_MODE, type EntrySlotContext } from '@ortha-cms/content-admin';
import { CONTENT_CREATE, LOCALE_PARAM } from '../../constants';
import { useLocales } from '../../api/useLocales';
import { useEntryLocales } from '../../api/useEntryLocales';
import { useCreateTranslation } from '../../api/useCreateTranslation';
import { LocaleRow } from './LocaleRow';

const messages = defineMessages({
    title: { id: 'i18n.widget.title', defaultMessage: 'Locales' },
    createTarget: {
        id: 'i18n.widget.createTarget',
        defaultMessage: 'This record will be created in {name}.'
    },
    conflict: {
        id: 'i18n.widget.conflict',
        defaultMessage:
            'That translation was just created elsewhere — refreshing.'
    },
    error: {
        id: 'i18n.widget.error',
        defaultMessage: 'Couldn’t create the translation. Please try again.'
    },
    created: {
        id: 'i18n.widget.created',
        defaultMessage: '{name} translation created.'
    }
});

/** HTTP status of a lost create-translation race (duplicate locale). */
const CONFLICT_STATUS = 409;

/**
 * The entry editor's **locale panel**, contributed into the sidebar widget
 * slot. One row per configured locale with its per-locale publish status:
 * the open row is marked, an existing sibling opens on click, and a missing
 * one offers **create translation** (all values copied as a starting point;
 * gated on `content:create`). On a single page, switching locales drives the
 * `?locale=` URL param instead (one row per locale, same editor). Renders
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
    const [searchParams, setSearchParams] = useSearchParams();
    const canCreate = useHasPermission(CONTENT_CREATE);
    const { locales, defaultLocale } = useLocales();
    const entryLocales = useEntryLocales(
        schema.name,
        entry?.id,
        !!schema.i18n
    );
    const createTranslation = useCreateTranslation(schema.name);
    const [creatingLocale, setCreatingLocale] = useState<string | null>(null);

    if (!schema.i18n || locales.length === 0) return null;

    const urlLocale = searchParams.get(LOCALE_PARAM) ?? undefined;
    const currentLocale =
        entry?.locale ?? urlLocale ?? defaultLocale?.slug ?? '';

    // Switch a single page's locale in place: its one-entry read (and blank
    // create fallback) key off the URL param, so setting it re-resolves.
    const switchSingleLocale = (slug: string) => {
        const next = new URLSearchParams(searchParams);
        if (slug === defaultLocale?.slug) next.delete(LOCALE_PARAM);
        else next.set(LOCALE_PARAM, slug);
        setSearchParams(next);
    };

    const create = (slug: string, name: string) => {
        if (!entry) return;
        setCreatingLocale(slug);
        createTranslation
            .mutateAsync({ sourceId: entry.id, locale: slug })
            .then((record) => {
                toast(intl.formatMessage(messages.created, { name }));
                navigate(`${typePath}/${record.id}`);
            })
            .catch((error: { status?: number }) => {
                toast(
                    intl.formatMessage(
                        error.status === CONFLICT_STATUS
                            ? messages.conflict
                            : messages.error
                    )
                );
                // A 409 means a sibling now exists — re-read so the row flips
                // from "Add" to "Open".
                entryLocales.refetch();
            })
            .finally(() => setCreatingLocale(null));
    };

    // While creating a brand-new record there's no group yet — show which
    // locale the create will target instead of a row list.
    if (isCreate || !entry) {
        const target =
            locales.find((locale) => locale.slug === currentLocale) ??
            defaultLocale;
        return (
            <Card className="shadow-none">
                <CardHeader>
                    <CardTitle className="text-base">
                        {intl.formatMessage(messages.title)}
                    </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                    {intl.formatMessage(messages.createTarget, {
                        name: target?.name ?? currentLocale
                    })}
                </CardContent>
            </Card>
        );
    }

    const items = entryLocales.data?.items;

    return (
        <Card className="shadow-none">
            <CardHeader>
                <CardTitle className="text-base">
                    {intl.formatMessage(messages.title)}
                </CardTitle>
            </CardHeader>
            <CardContent>
                <ul className="flex flex-col">
                    {locales.map((locale) => {
                        const item = items?.find(
                            (candidate) => candidate.locale === locale.slug
                        );
                        const exists = !!item?.entry;
                        const isCurrent = locale.slug === currentLocale;
                        return (
                            <LocaleRow
                                key={locale.slug}
                                name={locale.name}
                                isCurrent={isCurrent}
                                exists={exists}
                                status={item?.entry?.status}
                                creating={creatingLocale === locale.slug}
                                onOpen={
                                    exists && !isCurrent
                                        ? () =>
                                              mode === ENTRY_MODE.Single
                                                  ? switchSingleLocale(
                                                        locale.slug
                                                    )
                                                  : navigate(
                                                        `${typePath}/${item?.entry?.id}`
                                                    )
                                        : undefined
                                }
                                onCreate={
                                    !exists && !isCurrent && canCreate
                                        ? () =>
                                              // A single page's missing locale
                                              // is reached by switching — the
                                              // blank create form stamps the
                                              // locale on save. A collection
                                              // row copies the source via the
                                              // translations endpoint.
                                              mode === ENTRY_MODE.Single
                                                  ? switchSingleLocale(
                                                        locale.slug
                                                    )
                                                  : create(
                                                        locale.slug,
                                                        locale.name
                                                    )
                                        : undefined
                                }
                            />
                        );
                    })}
                </ul>
            </CardContent>
        </Card>
    );
}
