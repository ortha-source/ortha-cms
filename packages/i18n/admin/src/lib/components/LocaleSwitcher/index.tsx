import { useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { Check, ChevronDown, Globe } from 'lucide-react';
import {
    Button,
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    Popover,
    PopoverContent,
    PopoverTrigger
} from '@ortha-cms/design-system';
import type { RecordsToolbarContext } from '@ortha-cms/content-admin';
import { LOCALE_PARAM } from '../../constants';
import { useLocales } from '../../api/useLocales';

const messages = defineMessages({
    label: {
        id: 'i18n.switcher.label',
        defaultMessage: 'Locale: {name}'
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

/**
 * The records-toolbar **locale switcher** — a searchable dropdown of the
 * configured locales, contributed into the Content Library's toolbar slot.
 * The active locale is the table's `?locale=` URL param (owned by this item's
 * `listParamKeys`); the default locale keeps a clean URL, matching the
 * server's default scoping. Renders nothing for a non-i18n type.
 */
export function LocaleSwitcher({
    schema,
    params,
    updateParams
}: RecordsToolbarContext) {
    const intl = useIntl();
    const [open, setOpen] = useState(false);
    const { locales, defaultLocale } = useLocales();

    if (!schema.i18n || locales.length === 0) return null;

    const activeSlug = params[LOCALE_PARAM] ?? defaultLocale?.slug;
    const active =
        locales.find((locale) => locale.slug === activeSlug) ?? defaultLocale;

    const select = (slug: string) => {
        setOpen(false);
        updateParams({
            // Default locale = clean URL — the server scopes to it when the
            // param is absent, so the two spellings can't drift.
            [LOCALE_PARAM]: slug === defaultLocale?.slug ? undefined : slug
        });
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
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
            <PopoverContent className="w-56 p-0" align="end">
                <Command>
                    <CommandInput
                        placeholder={intl.formatMessage(
                            messages.searchPlaceholder
                        )}
                    />
                    <CommandList>
                        <CommandEmpty>
                            {intl.formatMessage(messages.empty)}
                        </CommandEmpty>
                        {/* Items live in a CommandGroup so its `p-1` inset keeps
                            the selected-row highlight clear of the popover's
                            rounded corners (matches MultiSelect / ⌘K palette). */}
                        <CommandGroup>
                            {locales.map((locale) => (
                                <CommandItem
                                    key={locale.slug}
                                    value={`${locale.slug} ${locale.name}`}
                                    onSelect={() => select(locale.slug)}
                                >
                                    <Check
                                        aria-hidden
                                        className={
                                            locale.slug === active?.slug
                                                ? 'size-4'
                                                : 'size-4 opacity-0'
                                        }
                                    />
                                    {locale.isDefault
                                        ? intl.formatMessage(
                                              messages.defaultSuffix,
                                              { name: locale.name }
                                          )
                                        : locale.name}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
