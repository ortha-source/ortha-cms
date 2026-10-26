import { defineMessages, useIntl } from 'react-intl';
import {
    BarRows,
    WidgetCard,
    toneBackground,
    type BarRowSpec,
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

    const rows: BarRowSpec[] = types.map((type) => {
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
        return {
            id: type.name,
            label: type.label,
            readout: intl.formatNumber(type.published + type.drafts),
            detail: intl.formatMessage(messages.breakdown, values),
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
            <BarRows rows={rows} max={max} />
        </WidgetCard>
    );
}
