import { useEffect, useMemo, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import {
    Button,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    Spinner,
    Table,
    TableBody,
    TableHead,
    TableHeader,
    TableRow
} from '@orthacms/design-system';
import { ENTRY_STATUS } from '@orthacms/content-admin';
import { useEntryTranslations } from '../../api/useEntryTranslations';
import { useLocales } from '../../api/useLocales';
import { localeName } from '../../domain/localePolicy';
import {
    localeState,
    PICK_PRESET,
    pickedEntryIds,
    presetPicks,
    setCell,
    setLocale,
    setRow,
    type PickPreset,
    type PickRow,
    type Picks
} from '../../domain/translationPicks';
import type { EntryTranslationMember } from '../../types/locale';
import { LocaleColumnHeader } from './LocaleColumnHeader';
import { TranslationRow } from './TranslationRow';

const messages = defineMessages({
    title: {
        id: 'i18n.publishTranslations.title',
        defaultMessage: 'Publish with translations'
    },
    body: {
        id: 'i18n.publishTranslations.body',
        defaultMessage:
            'Choose which locales to publish for {count, plural, one {the selected record} other {the # selected records}}. A column’s checkbox applies to every record; a cell to one. Everything picked is checked before anything publishes.'
    },
    presets: {
        id: 'i18n.publishTranslations.presets',
        defaultMessage: 'Quick picks'
    },
    presetAll: {
        id: 'i18n.publishTranslations.presetAll',
        defaultMessage: 'All translations'
    },
    presetOwn: {
        id: 'i18n.publishTranslations.presetOwn',
        defaultMessage: 'Selected locale only'
    },
    presetNone: {
        id: 'i18n.publishTranslations.presetNone',
        defaultMessage: 'Clear'
    },
    record: {
        id: 'i18n.publishTranslations.record',
        defaultMessage: 'Record'
    },
    table: {
        id: 'i18n.publishTranslations.table',
        defaultMessage: 'Translations to publish'
    },
    loading: {
        id: 'i18n.publishTranslations.loading',
        defaultMessage: 'Loading translations…'
    },
    error: {
        id: 'i18n.publishTranslations.error',
        defaultMessage: 'Couldn’t load the translations of these records.'
    },
    retry: {
        id: 'i18n.publishTranslations.retry',
        defaultMessage: 'Retry'
    },
    gone: {
        id: 'i18n.publishTranslations.gone',
        defaultMessage:
            '{count, plural, one {# selected record is} other {# selected records are}} no longer available and won’t be published.'
    },
    summary: {
        id: 'i18n.publishTranslations.summary',
        defaultMessage:
            '{count, plural, =0 {Nothing picked yet.} one {# entry will be checked.} other {# entries will be checked.}}'
    },
    cancel: {
        id: 'i18n.publishTranslations.cancel',
        defaultMessage: 'Cancel'
    },
    continue: {
        id: 'i18n.publishTranslations.continue',
        defaultMessage:
            'Review {count, plural, one {# entry} other {# entries}}'
    },
    rowName: {
        id: 'i18n.publishTranslations.rowName',
        defaultMessage: '{record} · {locale}'
    }
});

/** What the picker hands on: the entries to publish and how to name each. */
export type TranslationsPicked = {
    /** Entry ids, in row order then config order. */
    ids: string[];
    /** A review row's name — "{title} · {language}" — by entry id. */
    labelFor: (id: string) => string | undefined;
};

/** One selected record after the read, ready to render. */
type LoadedRow = {
    row: PickRow;
    name: string;
    members: ReadonlyMap<string, EntryTranslationMember>;
};

/**
 * Step one of **Publish with translations**: a matrix of the selected records
 * against the configured locales, where the reader picks which translations go
 * out — a whole locale for every record from its column header, everything of
 * one record from its row, or one cell at a time. It starts with every
 * translation that has something to publish picked, since that is what the
 * action is for; "Selected locale only" is one click back to a plain bulk
 * publish.
 *
 * It publishes nothing. Continuing hands the picked entry ids to content's
 * `BulkPublishDialog` (via `onContinue`), whose dry run is still the one place
 * that decides what can actually publish — translations are entries of the
 * same type, so validation, guards and partial success are exactly a plain
 * bulk publish's.
 */
export function PublishTranslationsDialog({
    open,
    onOpenChange,
    typeName,
    ids,
    onContinue
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    typeName: string;
    /** The selected entry ids. */
    ids: string[];
    onContinue: (picked: TranslationsPicked) => void;
}) {
    const intl = useIntl();
    const { locales } = useLocales();
    const translations = useEntryTranslations(typeName, ids, open);

    const nameOf = (slug: string) => localeName(locales, slug) ?? slug;

    const loaded = useMemo<LoadedRow[]>(() => {
        const entries = translations.data?.entries ?? {};
        return ids.flatMap((id) => {
            const item = entries[id];
            if (!item) return [];
            const members = new Map(
                item.members.map((member) => [member.locale, member])
            );
            // An option is a translation with something to publish — a live
            // one would only come back from the dry run as "already published".
            const options = new Map(
                item.members
                    .filter(
                        (member) => member.status !== ENTRY_STATUS.Published
                    )
                    .map((member) => [member.locale, member.entryId])
            );
            return [
                {
                    row: { id, locale: item.locale, options },
                    name: item.title ?? id,
                    members
                }
            ];
        });
    }, [ids, translations.data]);
    const rows = useMemo(() => loaded.map((entry) => entry.row), [loaded]);
    const gone = translations.data ? ids.length - loaded.length : 0;

    // The columns: the configured locales in config order, or — when that read
    // failed — whichever locales the groups actually hold, so a failed list
    // costs the names, not the picker.
    const columns = useMemo(() => {
        const slugs = locales.length
            ? locales.map((locale) => locale.slug)
            : [
                  ...new Set(
                      loaded.flatMap((entry) => [...entry.members.keys()])
                  )
              ];
        return slugs.map((slug) => ({
            slug,
            name: localeName(locales, slug) ?? slug
        }));
    }, [locales, loaded]);

    const [picks, setPicks] = useState<Picks>(new Map());
    // Re-seeded whenever a read lands — every open refetches, and picks made
    // against the previous answer may name a translation that has since gone
    // live or away.
    useEffect(() => {
        if (open && translations.data) {
            setPicks(presetPicks(rows, PICK_PRESET.All));
        }
        // `rows` derives from `translations.data`; keying on the data keeps a
        // re-render from wiping the reader's picks.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, translations.data]);

    const picked = pickedEntryIds(picks, rows);

    const onConfirm = () => {
        const labels = new Map<string, string>();
        for (const entry of loaded) {
            for (const member of entry.members.values()) {
                labels.set(
                    member.entryId,
                    intl.formatMessage(messages.rowName, {
                        record: member.title ?? entry.name,
                        locale: nameOf(member.locale)
                    })
                );
            }
        }
        onContinue({ ids: picked, labelFor: (id) => labels.get(id) });
    };

    const preset = (value: PickPreset) => setPicks(presetPicks(rows, value));

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl">
                <DialogHeader>
                    <DialogTitle>
                        {intl.formatMessage(messages.title)}
                    </DialogTitle>
                    <DialogDescription>
                        {intl.formatMessage(messages.body, {
                            count: ids.length
                        })}
                    </DialogDescription>
                </DialogHeader>

                {translations.isPending ? (
                    <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                        <Spinner aria-hidden />
                        {intl.formatMessage(messages.loading)}
                    </div>
                ) : translations.isError ? (
                    <div className="flex items-center justify-between gap-2 py-4">
                        <p role="alert" className="text-sm text-destructive">
                            {intl.formatMessage(messages.error)}
                        </p>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => void translations.refetch()}
                        >
                            {intl.formatMessage(messages.retry)}
                        </Button>
                    </div>
                ) : (
                    <>
                        <div
                            role="group"
                            aria-label={intl.formatMessage(messages.presets)}
                            className="flex flex-wrap gap-2"
                        >
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="shadow-none"
                                onClick={() => preset(PICK_PRESET.All)}
                            >
                                {intl.formatMessage(messages.presetAll)}
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="shadow-none"
                                onClick={() => preset(PICK_PRESET.Own)}
                            >
                                {intl.formatMessage(messages.presetOwn)}
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => preset(PICK_PRESET.None)}
                            >
                                {intl.formatMessage(messages.presetNone)}
                            </Button>
                        </div>

                        <div className="max-h-96 overflow-auto">
                            <Table
                                aria-label={intl.formatMessage(messages.table)}
                            >
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="sticky left-0 z-10">
                                            {intl.formatMessage(
                                                messages.record
                                            )}
                                        </TableHead>
                                        {columns.map((column) => (
                                            <LocaleColumnHeader
                                                key={column.slug}
                                                slug={column.slug}
                                                name={column.name}
                                                state={localeState(
                                                    picks,
                                                    rows,
                                                    column.slug
                                                )}
                                                onToggle={(on) =>
                                                    setPicks((current) =>
                                                        setLocale(
                                                            current,
                                                            rows,
                                                            column.slug,
                                                            on
                                                        )
                                                    )
                                                }
                                            />
                                        ))}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loaded.map((entry) => (
                                        <TranslationRow
                                            key={entry.row.id}
                                            row={entry.row}
                                            name={entry.name}
                                            members={entry.members}
                                            locales={columns}
                                            picks={picks}
                                            onToggleRow={(on) =>
                                                setPicks((current) =>
                                                    setRow(
                                                        current,
                                                        entry.row,
                                                        on
                                                    )
                                                )
                                            }
                                            onToggleCell={(locale, on) =>
                                                setPicks((current) =>
                                                    setCell(
                                                        current,
                                                        entry.row,
                                                        locale,
                                                        on
                                                    )
                                                )
                                            }
                                        />
                                    ))}
                                </TableBody>
                            </Table>
                        </div>

                        {gone > 0 && (
                            <p className="text-sm text-muted-foreground">
                                {intl.formatMessage(messages.gone, {
                                    count: gone
                                })}
                            </p>
                        )}
                        {/* Announced, so a screen-reader user hears what each
                            toggle did to the total — and why Review is
                            disabled at zero. */}
                        <p
                            role="status"
                            className="text-sm text-muted-foreground"
                        >
                            {intl.formatMessage(messages.summary, {
                                count: picked.length
                            })}
                        </p>
                    </>
                )}

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                    >
                        {intl.formatMessage(messages.cancel)}
                    </Button>
                    <Button
                        onClick={onConfirm}
                        disabled={
                            translations.isPending ||
                            translations.isError ||
                            picked.length === 0
                        }
                    >
                        {intl.formatMessage(messages.continue, {
                            count: picked.length
                        })}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
