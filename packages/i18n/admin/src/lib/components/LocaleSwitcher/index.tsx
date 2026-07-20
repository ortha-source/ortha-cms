import { useMemo, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { Check, ChevronDown, Globe } from 'lucide-react';
import {
    Button,
    Input,
    Popover,
    PopoverContent,
    PopoverTrigger,
    cn
} from '@ortha-cms/design-system';
import type { RecordsToolbarContext } from '@ortha-cms/content-admin';
import { LOCALE_PARAM } from '../../constants';
import {
    localeName,
    resolveActiveLocale,
    toLocaleListParam
} from '../../domain/localePolicy';
import { useLocales } from '../../api/useLocales';
import { beginLocaleSwitch } from '../../utils/localeTransition';
import { LocaleSwitchOverlay } from '../LocaleSwitchOverlay';

const messages = defineMessages({
    label: {
        id: 'i18n.switcher.label',
        defaultMessage: 'Locale: {name}'
    },
    list: {
        id: 'i18n.switcher.list',
        defaultMessage: 'Locales'
    },
    searchPlaceholder: {
        id: 'i18n.switcher.searchPlaceholder',
        defaultMessage: 'Search locales…'
    },
    empty: {
        id: 'i18n.switcher.empty',
        defaultMessage: 'No locale found.'
    },
    defaultSuffix: {
        id: 'i18n.switcher.defaultSuffix',
        defaultMessage: '{name} (default)'
    }
});

/** Case-insensitive match of a locale's name/slug against the search query. */
function matches(haystack: string, query: string): boolean {
    return haystack.toLowerCase().includes(query.trim().toLowerCase());
}

/**
 * The records-toolbar **locale switcher** — a searchable dropdown of the
 * configured locales, contributed into the Content Library's toolbar slot.
 * The active locale is the table's `?locale=` URL param (owned by this item's
 * `listParamKeys`); the default locale keeps a clean URL, matching the
 * server's default scoping. Renders nothing for a non-i18n type.
 *
 * Structured like the records column picker / query-builder field picker (a
 * padded `Popover` + a plain `Input` over one `overflow-y-auto` list) rather
 * than a cmdk `Command`, so the mouse wheel scrolls the list and the rounded
 * border stays clean. The trigger keeps its `Locale: {name}` label and each row
 * `role="option"`.
 */
export function LocaleSwitcher({
    schema,
    params,
    updateParams
}: RecordsToolbarContext) {
    const intl = useIntl();
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const { locales, defaultLocale } = useLocales();

    const activeSlug = resolveActiveLocale({
        urlLocale: params[LOCALE_PARAM],
        defaultSlug: defaultLocale?.slug
    });

    const filtered = useMemo(
        () =>
            locales.filter((locale) =>
                matches(`${locale.slug} ${locale.name}`, query)
            ),
        [locales, query]
    );

    if (!schema.i18n || locales.length === 0) return null;

    const active =
        locales.find((locale) => locale.slug === activeSlug) ?? defaultLocale;

    const select = (slug: string) => {
        setOpen(false);
        // Re-selecting the active locale is a no-op — no re-scope, no flourish.
        if (slug === active?.slug) return;
        const name = localeName(locales, slug) ?? slug;
        // Defer the re-scope until the overlay covers the page (see
        // `beginLocaleSwitch`) so the table doesn't visibly swap under the blur.
        beginLocaleSwitch(name, () => {
            updateParams({
                // Default locale = clean URL — the server scopes to it when the
                // param is absent, so the two spellings can't drift.
                [LOCALE_PARAM]: toLocaleListParam(slug, defaultLocale?.slug)
            });
        });
    };

    return (
        <>
            <Popover
                open={open}
                onOpenChange={(next) => {
                    setOpen(next);
                    if (!next) setQuery('');
                }}
            >
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        className="shadow-none"
                        aria-label={intl.formatMessage(messages.label, {
                            name: active?.name ?? ''
                        })}
                    >
                        <Globe aria-hidden className="size-4" />
                        {active?.name}
                        <ChevronDown
                            aria-hidden
                            className="size-3.5 text-muted-foreground"
                        />
                    </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-56 p-2">
                    <Input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder={intl.formatMessage(
                            messages.searchPlaceholder
                        )}
                        aria-label={intl.formatMessage(
                            messages.searchPlaceholder
                        )}
                        className="mb-1 h-8 rounded-lg shadow-none"
                    />
                    {/* Only the list scrolls (plain container → mouse wheel
                        works), so the search box stays put. */}
                    <div
                        role="listbox"
                        aria-label={intl.formatMessage(messages.list)}
                        className="max-h-72 overflow-y-auto"
                    >
                        {filtered.length === 0 ? (
                            <p className="px-1 py-3 text-center text-xs text-muted-foreground">
                                {intl.formatMessage(messages.empty)}
                            </p>
                        ) : (
                            filtered.map((locale) => {
                                const isActive = locale.slug === active?.slug;
                                return (
                                    <button
                                        key={locale.slug}
                                        type="button"
                                        role="option"
                                        aria-selected={isActive}
                                        onClick={() => select(locale.slug)}
                                        className={cn(
                                            'flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm',
                                            'hover:bg-accent hover:text-accent-foreground',
                                            'focus-visible:bg-accent focus-visible:outline-none',
                                            isActive && 'bg-accent/50'
                                        )}
                                    >
                                        <Check
                                            aria-hidden
                                            className={cn(
                                                'mr-2 size-4 shrink-0',
                                                isActive
                                                    ? 'opacity-100'
                                                    : 'opacity-0'
                                            )}
                                        />
                                        <span className="truncate">
                                            {locale.isDefault
                                                ? intl.formatMessage(
                                                      messages.defaultSuffix,
                                                      { name: locale.name }
                                                  )
                                                : locale.name}
                                        </span>
                                    </button>
                                );
                            })
                        )}
                    </div>
                </PopoverContent>
            </Popover>
            <LocaleSwitchOverlay />
        </>
    );
}
