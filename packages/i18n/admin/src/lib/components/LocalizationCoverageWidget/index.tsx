import { useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import {
    BarRows,
    WidgetCard,
    type BarRowSpec
} from '@orthacms/insights-admin';
import { useLocalizationCoverage } from '../../api/useLocalizationCoverage';
import { CoverageModeToggle, type CoverageMode } from './CoverageModeToggle';

/** Intl descriptors for the coverage widget, co-located here. */
const messages = defineMessages({
    title: {
        id: 'i18n.insights.coverage.title',
        defaultMessage: 'Translation coverage'
    },
    description: {
        id: 'i18n.insights.coverage.records',
        defaultMessage:
            'of {records, number} localized {records, plural, one {record} other {records}}'
    },
    defaultLocale: {
        id: 'i18n.insights.coverage.defaultLocale',
        defaultMessage: '{name} (default)'
    },
    empty: {
        id: 'i18n.insights.coverage.empty',
        defaultMessage: 'No localized content in this workspace yet.'
    },
    // The readout: what is done and what is missing, side by side — a
    // percentage alone is a score, the missing count is the job.
    localeReadout: {
        id: 'i18n.insights.coverage.localeReadout',
        defaultMessage: '{share} · {missing, number} missing'
    },
    typeReadout: {
        id: 'i18n.insights.coverage.typeReadout',
        defaultMessage: '{share} · {outstanding, number} to translate'
    },
    // Each bar's text alternative names both halves — the drawn one and the
    // one left as empty track — as a whole sentence, read aloud.
    tipLocale: {
        id: 'i18n.insights.coverage.tipLocale',
        defaultMessage:
            '{locale} — {translated, number} {translated, plural, one {record} other {records}} translated, {missing, number} {missing, plural, one {record} other {records}} missing'
    },
    tipType: {
        id: 'i18n.insights.coverage.tipType',
        defaultMessage:
            '{type} — {done, number} {done, plural, one {record} other {records}} in every language, {outstanding, number} still to translate'
    }
});

/**
 * How much of the workspace's localized content has been translated, broken
 * down **by language or by content type**.
 *
 * Two questions off one payload, which is why they are a view swap rather than
 * two cards: "which language is behind?" and "which content type is the work
 * in?" are asked by the same person a moment apart.
 *
 * Each row is **a percentage and what is missing** — "86% · 118 missing" —
 * because a share alone is a score and the missing count is the job. The bar
 * draws the translated part over an empty track; its text alternative names
 * both halves, so the missing count never reaches a reader through the track's
 * absence alone.
 *
 * **The unit is a record, not a row.** A localized entry is one row per
 * language sharing a translation group, so a bar counting rows would report a
 * workspace of 40 stories in 3 languages as 120 things and make every share
 * here meaningless. Everything below counts groups.
 */
export function LocalizationCoverageWidget() {
    const intl = useIntl();
    const [mode, setMode] = useState<CoverageMode>('locale');
    const { data, isPending, isError } = useLocalizationCoverage();

    const records = data?.records ?? 0;
    const locales = data?.locales ?? [];
    const types = data?.types ?? [];

    const localeRows: BarRowSpec[] = locales.map((locale) => {
        const name = locale.isDefault
            ? intl.formatMessage(messages.defaultLocale, { name: locale.name })
            : locale.name;
        return {
            id: locale.locale,
            label: name,
            segments: [
                {
                    id: 'translated',
                    value: locale.translated,
                    tone: 'series-1',
                    label: intl.formatMessage(messages.tipLocale, {
                        locale: name,
                        translated: locale.translated,
                        missing: locale.missing
                    })
                }
            ],
            readout: intl.formatMessage(messages.localeReadout, {
                share: share(locale.translated, records) ?? '0%',
                missing: locale.missing
            })
        };
    });

    const typeRows: BarRowSpec[] = types.map((type) => ({
        id: type.name,
        label: type.label,
        segments: [
            {
                id: 'localized',
                value: type.localized,
                tone: 'series-1',
                label: intl.formatMessage(messages.tipType, {
                    type: type.label,
                    done: type.localized,
                    outstanding: type.requiresLocalization
                })
            }
        ],
        readout: intl.formatMessage(messages.typeReadout, {
            share: share(type.localized, type.records) ?? '0%',
            outstanding: type.requiresLocalization
        })
    }));

    // Nothing localized at all: the card has no coverage to report, which is
    // not the same as having reported full coverage.
    const isEmpty = records === 0;
    const byLocale = mode === 'locale';
    // Every bar is scaled against one denominator so lengths compare. By locale
    // that is the workspace's record count (each language could reach all of
    // them); by type it is the biggest type, so a row's length reads as how
    // much of the work that type holds is done — the readout carries its share.
    const typeMax = Math.max(...types.map((type) => type.records), 0);

    return (
        <WidgetCard
            title={intl.formatMessage(messages.title)}
            description={
                data
                    ? intl.formatMessage(messages.description, { records })
                    : undefined
            }
            action={
                isEmpty ? undefined : (
                    <CoverageModeToggle value={mode} onChange={setMode} />
                )
            }
            isPending={isPending}
            isError={isError}
            isEmpty={isEmpty}
            // The shared empty copy says "for this period", and this widget
            // takes no range — an untranslated record is untranslated whenever
            // it was written.
            emptyMessage={intl.formatMessage(messages.empty)}
            skeletonRows={4}
        >
            <BarRows
                rows={byLocale ? localeRows : typeRows}
                max={byLocale ? records : typeMax}
            />
        </WidgetCard>
    );
}

/**
 * A count as a whole-percent share of its total, or nothing when there is none.
 *
 * `0%` and `100%` are **reserved for the real thing**. Plain rounding printed
 * "0%" beside a visible bar (3 of 609 translated) and "100%" beside a card
 * whose own chip said work remained (608 of 609) — the two readings a coverage
 * figure exists to distinguish, so a rounded near-miss is clamped to 1% / 99%
 * instead of claiming the boundary.
 *
 * `total <= 0` yields nothing rather than `NaN%` — the server sends counts and
 * never divides, so every division on this card happens here.
 */
function share(value: number, total: number): string | undefined {
    if (total <= 0) return undefined;
    if (value <= 0) return '0%';
    if (value >= total) return '100%';
    const rounded = Math.round((value / total) * 100);
    return `${Math.min(99, Math.max(1, rounded))}%`;
}
