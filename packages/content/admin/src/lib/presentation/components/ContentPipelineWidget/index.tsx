import { defineMessages, useIntl } from 'react-intl';
import { cn } from '@orthacms/design-system';
import {
    WidgetCard,
    toneBackground,
    type ChartTone
} from '@orthacms/insights-admin';
import { useContentPipeline } from '../../../application/useContentInsights';

/** Intl descriptors for the by-type widget, co-located here. */
const messages = defineMessages({
    title: {
        id: 'content.insights.pipeline.title',
        defaultMessage: 'By type'
    },
    published: {
        id: 'content.insights.pipeline.published',
        defaultMessage: 'published'
    },
    modified: {
        id: 'content.insights.pipeline.modified',
        defaultMessage: 'modified'
    },
    drafts: {
        id: 'content.insights.pipeline.drafts',
        defaultMessage: 'draft'
    },
    tipPublished: {
        id: 'content.insights.pipeline.tipPublished',
        defaultMessage: '{type} — {count, number} published'
    },
    tipModified: {
        id: 'content.insights.pipeline.tipModified',
        defaultMessage: '{type} — {count, number} modified'
    },
    tipDrafts: {
        id: 'content.insights.pipeline.tipDrafts',
        defaultMessage: '{type} — {count, number} draft'
    },
    breakdown: {
        id: 'content.insights.pipeline.breakdown',
        defaultMessage:
            '{published, number} published · {modified, number} modified · {drafts, number} draft'
    }
});

/** The three states, left to right, each with its one tone. */
const STATES: {
    id: 'published' | 'modified' | 'drafts';
    tone: ChartTone;
}[] = [
    { id: 'published', tone: 'series-1' },
    { id: 'modified', tone: 'series-2' },
    // The remainder — never shipped — is the neutral grey, not a third hue:
    // the palette has two categorical slots and no more.
    { id: 'drafts', tone: 'neutral' }
];

/**
 * Each content type's records split by publish state — published, live with
 * unpublished edits (modified), and never shipped (draft) — so a type's bar
 * says both how much it holds and how much of it is current.
 *
 * Counts sit in the readout column, never inside a fill: a small segment can
 * be a couple of pixels wide, far too narrow to carry a number.
 */
export function ContentPipelineWidget() {
    const intl = useIntl();
    const { data, isPending, isError } = useContentPipeline();

    const types = data?.types ?? [];
    const max = Math.max(
        ...types.map((type) => type.published + type.drafts),
        0
    );

    const rows = types.map((type) => {
        const modified = Math.min(type.modified ?? 0, type.drafts);
        const values = {
            published: type.published,
            modified,
            drafts: type.drafts - modified
        };
        const tips = {
            published: messages.tipPublished,
            modified: messages.tipModified,
            drafts: messages.tipDrafts
        };
        const total = type.published + type.drafts;
        return {
            id: type.name,
            label: type.label,
            total,
            values,
            segments: STATES.map((state) => ({
                id: state.id,
                value: values[state.id],
                tone: state.tone,
                label: intl.formatMessage(tips[state.id], {
                    type: type.label,
                    count: values[state.id]
                })
            }))
        };
    });

    const legend = (
        <span className="inline-flex flex-wrap items-center gap-x-2.5 gap-y-1">
            {STATES.map((state) => (
                <span key={state.id} className="inline-flex items-center gap-1">
                    <span
                        aria-hidden="true"
                        className={`block size-2 rounded-full ${toneBackground(state.tone)}`}
                    />
                    {intl.formatMessage(messages[state.id])}
                </span>
            ))}
        </span>
    );

    return (
        <WidgetCard
            title={intl.formatMessage(messages.title)}
            description={legend}
            isPending={isPending}
            isError={isError}
            isEmpty={types.length === 0}
            skeletonRows={5}
        >
            {/* Its own rows rather than the shared `BarRows`: a type reads
                as name and total, one track whose filled length compares it
                with the biggest type, and the breakdown in words. The
                segments sit flush inside a single rounded fill, so the bar
                reads as one quantity split three ways. */}
            <ul className="flex flex-col gap-4">
                {rows.map((row) => (
                    <li key={row.id} className="flex flex-col gap-1.5">
                        <div className="flex items-baseline justify-between gap-3 text-sm">
                            <span className="truncate font-medium">
                                {row.label}
                            </span>
                            <span className="shrink-0 tabular-nums">
                                {intl.formatNumber(row.total)}
                            </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                            <div
                                role="img"
                                aria-label={row.segments
                                    .map((segment) => segment.label)
                                    .join('. ')}
                                className="flex h-full divide-x divide-background overflow-hidden rounded-full"
                                style={{
                                    width: `${max > 0 ? Math.max(2, (row.total / max) * 100) : 0}%`
                                }}
                            >
                                {row.segments
                                    .filter((segment) => segment.value > 0)
                                    .map((segment) => (
                                        <span
                                            key={segment.id}
                                            title={segment.label}
                                            style={{
                                                flexGrow: segment.value
                                            }}
                                            className={cn(
                                                'h-full min-w-[3px] basis-0',
                                                toneBackground(segment.tone)
                                            )}
                                        />
                                    ))}
                            </div>
                        </div>
                        <span className="text-xs tabular-nums text-muted-foreground">
                            {intl.formatMessage(messages.breakdown, row.values)}
                        </span>
                    </li>
                ))}
            </ul>
        </WidgetCard>
    );
}
