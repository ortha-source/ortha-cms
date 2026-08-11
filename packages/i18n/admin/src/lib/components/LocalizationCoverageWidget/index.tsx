import { defineMessages, useIntl } from 'react-intl';
import { Check, Languages } from 'lucide-react';
import {
    BarRows,
    WidgetCard,
    WidgetChip,
    toneBackground,
    type BarRowSpec
} from '@ortha-cms/insights-admin';
import { useLocalizationCoverage } from '../../api/useLocalizationCoverage';
import { CoverageFigure } from './CoverageFigure';

/** Intl descriptors for the coverage widget, co-located here. */
const messages = defineMessages({
    title: {
        id: 'i18n.insights.coverage.title',
        defaultMessage: 'Translation coverage'
    },
    description: {
        id: 'i18n.insights.coverage.description',
        defaultMessage: 'How far each language has been taken'
    },
    complete: {
        id: 'i18n.insights.coverage.complete',
        defaultMessage: 'Fully translated'
    },
    pending: {
        id: 'i18n.insights.coverage.pending',
        defaultMessage: '{count, number} to translate'
    },
    localized: {
        id: 'i18n.insights.coverage.localized',
        defaultMessage: 'Localized'
    },
    localizedHint: {
        id: 'i18n.insights.coverage.localizedHint',
        defaultMessage: 'in every language'
    },
    notLocalized: {
        id: 'i18n.insights.coverage.notLocalized',
        defaultMessage: 'Not localized'
    },
    notLocalizedHint: {
        id: 'i18n.insights.coverage.notLocalizedHint',
        defaultMessage: 'no translations started'
    },
    requires: {
        id: 'i18n.insights.coverage.requires',
        defaultMessage: 'Needs translation'
    },
    requiresHint: {
        id: 'i18n.insights.coverage.requiresHint',
        defaultMessage: 'missing at least one'
    },
    translatedLegend: {
        id: 'i18n.insights.coverage.translatedLegend',
        defaultMessage: 'Translated'
    },
    missingLegend: {
        id: 'i18n.insights.coverage.missingLegend',
        defaultMessage: 'Missing'
    },
    defaultLocale: {
        id: 'i18n.insights.coverage.defaultLocale',
        defaultMessage: '{name} (default)'
    },
    tipTranslated: {
        id: 'i18n.insights.coverage.tipTranslated',
        defaultMessage: '{locale} — {count, number} records translated'
    },
    tipMissing: {
        id: 'i18n.insights.coverage.tipMissing',
        defaultMessage: '{locale} — {count, number} records missing'
    },
    footer: {
        id: 'i18n.insights.coverage.footer',
        defaultMessage:
            'Across {records, number} localized {records, plural, one {record} other {records}} in {types, number} {types, plural, one {content type} other {content types}}.'
    }
});

/**
 * How much of the workspace's localized content exists in each language.
 *
 * **The unit is a record, not a row.** A localized entry is one row per
 * language sharing a translation group, so a bar counting rows would report a
 * workspace of 40 stories in 3 languages as 120 things and make every share
 * here meaningless. Everything below counts groups.
 *
 * The three figures are deliberately **not** a partition. "Not localized" is a
 * subset of "needs translation" — a record in one of four languages both has no
 * translations and needs some — because those are two different jobs: starting
 * a translation and finishing one. Rendering them as slices of a pie would be
 * the wrong chart for the same reason it would be the wrong sentence.
 */
export function LocalizationCoverageWidget() {
    const intl = useIntl();
    const { data, isPending, isError } = useLocalizationCoverage();

    const records = data?.records ?? 0;
    const locales = data?.locales ?? [];
    const requires = data?.requiresLocalization ?? 0;

    const rows: BarRowSpec[] = locales.map((locale) => {
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
                    label: intl.formatMessage(messages.tipTranslated, {
                        locale: name,
                        count: locale.translated
                    })
                },
                {
                    id: 'missing',
                    value: locale.missing,
                    tone: 'series-2',
                    label: intl.formatMessage(messages.tipMissing, {
                        locale: name,
                        count: locale.missing
                    })
                }
            ],
            readout: intl.formatNumber(locale.translated),
            secondary:
                records > 0
                    ? `${Math.round((locale.translated / records) * 100)}%`
                    : undefined
        };
    });

    return (
        <WidgetCard
            title={intl.formatMessage(messages.title)}
            description={intl.formatMessage(messages.description)}
            action={
                requires === 0 ? (
                    <WidgetChip tone="ok" icon={Check}>
                        {intl.formatMessage(messages.complete)}
                    </WidgetChip>
                ) : (
                    <WidgetChip tone="warn" icon={Languages}>
                        {intl.formatMessage(messages.pending, {
                            count: requires
                        })}
                    </WidgetChip>
                )
            }
            footer={intl.formatMessage(messages.footer, {
                records,
                types: data?.types ?? 0
            })}
            isPending={isPending}
            isError={isError}
            isEmpty={records === 0}
            skeletonRows={4}
        >
            <div className="grid gap-4 lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] lg:gap-6">
                <div className="grid grid-cols-3 gap-3 lg:grid-cols-1 lg:gap-4">
                    <CoverageFigure
                        value={data?.localized ?? 0}
                        label={intl.formatMessage(messages.localized)}
                        hint={intl.formatMessage(messages.localizedHint)}
                    />
                    <CoverageFigure
                        value={data?.notLocalized ?? 0}
                        label={intl.formatMessage(messages.notLocalized)}
                        hint={intl.formatMessage(messages.notLocalizedHint)}
                    />
                    <CoverageFigure
                        value={requires}
                        label={intl.formatMessage(messages.requires)}
                        hint={intl.formatMessage(messages.requiresHint)}
                    />
                </div>

                <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5">
                            <span
                                className={`block size-2 rounded-[2px] ${toneBackground('series-1')}`}
                            />
                            {intl.formatMessage(messages.translatedLegend)}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                            <span
                                className={`block size-2 rounded-[2px] ${toneBackground('series-2')}`}
                            />
                            {intl.formatMessage(messages.missingLegend)}
                        </span>
                    </div>
                    <BarRows rows={rows} max={records} />
                </div>
            </div>
        </WidgetCard>
    );
}
